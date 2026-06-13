/*
  Production hardening for authentication, prediction locking, RLS, and scoring.
  This migration is intentionally additive so it can be applied to an existing project.
*/

-- Profiles and score rows are created by the database, including when email
-- confirmation means the browser does not yet have an authenticated session.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_scores (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill users created before this trigger existed.
INSERT INTO public.profiles (id, display_name)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_scores (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Only the service role may mutate source-of-truth match and score data.
DROP POLICY IF EXISTS "matches_admin_update" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_insert" ON public.matches;
DROP POLICY IF EXISTS "user_scores_admin_update" ON public.user_scores;
DROP POLICY IF EXISTS "user_scores_admin_insert" ON public.user_scores;

-- Predictions are private while they are being played. The leaderboard exposes
-- aggregate scores, not another player's picks.
DROP POLICY IF EXISTS "predictions_user_read" ON public.predictions;
CREATE POLICY "predictions_read_own" ON public.predictions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "predictions_user_delete" ON public.predictions;

DROP POLICY IF EXISTS "round_goals_user_read" ON public.round_goals;
CREATE POLICY "round_goals_read_own" ON public.round_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "round_goals_user_delete" ON public.round_goals;

-- Browser writes may only change the user's pick before kickoff. Calculated
-- fields are always controlled by the backend.
CREATE OR REPLACE FUNCTION public.protect_prediction_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  match_kickoff timestamptz;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT kickoff_at INTO match_kickoff
  FROM public.matches
  WHERE id = NEW.match_id;

  IF match_kickoff IS NULL OR match_kickoff <= now() THEN
    RAISE EXCEPTION 'Predictions are locked after kickoff';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.is_exact_score_correct := false;
    NEW.is_outcome_correct := false;
    NEW.points_awarded := 0;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.match_id := OLD.match_id;
    NEW.is_exact_score_correct := OLD.is_exact_score_correct;
    NEW.is_outcome_correct := OLD.is_outcome_correct;
    NEW.points_awarded := OLD.points_awarded;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_prediction_write_trigger ON public.predictions;
CREATE TRIGGER protect_prediction_write_trigger
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.protect_prediction_write();

CREATE OR REPLACE FUNCTION public.protect_round_goal_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  round_kickoff timestamptz;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT min(kickoff_at) INTO round_kickoff
  FROM public.matches
  WHERE round = NEW.round;

  IF round_kickoff IS NULL OR round_kickoff <= now() THEN
    RAISE EXCEPTION 'Round prediction is locked after the first kickoff';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.actual_total_goals := NULL;
    NEW.points_awarded := NULL;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.round := OLD.round;
    NEW.actual_total_goals := OLD.actual_total_goals;
    NEW.points_awarded := OLD.points_awarded;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_round_goal_write_trigger ON public.round_goals;
CREATE TRIGGER protect_round_goal_write_trigger
  BEFORE INSERT OR UPDATE ON public.round_goals
  FOR EACH ROW EXECUTE FUNCTION public.protect_round_goal_write();

-- Rebuild all calculated values from source data. This is idempotent and avoids
-- duplicate points if a scheduled job runs more than once.
CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.predictions p
  SET
    is_outcome_correct = p.predicted_outcome = CASE
      WHEN m.home_score > m.away_score THEN '1'
      WHEN m.home_score < m.away_score THEN '2'
      ELSE 'X'
    END,
    is_exact_score_correct = p.predicted_home_score = m.home_score
      AND p.predicted_away_score = m.away_score,
    points_awarded =
      CASE
        WHEN p.predicted_outcome = CASE
          WHEN m.home_score > m.away_score THEN '1'
          WHEN m.home_score < m.away_score THEN '2'
          ELSE 'X'
        END
        THEN CASE p.predicted_outcome
          WHEN '1' THEN m.odds_home * 10
          WHEN 'X' THEN m.odds_draw * 10
          ELSE m.odds_away * 10
        END
        ELSE 0
      END
      + CASE
          WHEN p.predicted_home_score = m.home_score
            AND p.predicted_away_score = m.away_score THEN 50
          ELSE 0
        END,
    updated_at = now()
  FROM public.matches m
  WHERE p.match_id = m.id
    AND m.status = 'finished'
    AND m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL;

  WITH completed_rounds AS (
    SELECT
      round,
      sum(home_score + away_score)::int AS total_goals
    FROM public.matches
    GROUP BY round
    HAVING count(*) > 0
      AND bool_and(status = 'finished')
      AND bool_and(home_score IS NOT NULL AND away_score IS NOT NULL)
  )
  UPDATE public.round_goals rg
  SET
    actual_total_goals = cr.total_goals,
    points_awarded = greatest(0, 100 - abs(rg.predicted_total_goals - cr.total_goals) * 2),
    updated_at = now()
  FROM completed_rounds cr
  WHERE rg.round = cr.round;

  INSERT INTO public.user_scores (
    user_id,
    total_match_points,
    total_round_goal_points,
    exact_score_bonuses,
    last_updated
  )
  SELECT
    p.id,
    COALESCE((SELECT sum(pr.points_awarded) FROM public.predictions pr WHERE pr.user_id = p.id), 0),
    COALESCE((SELECT sum(rg.points_awarded) FROM public.round_goals rg WHERE rg.user_id = p.id), 0),
    COALESCE((SELECT count(*) FROM public.predictions pr WHERE pr.user_id = p.id AND pr.is_exact_score_correct), 0),
    now()
  FROM public.profiles p
  ON CONFLICT (user_id) DO UPDATE SET
    total_match_points = EXCLUDED.total_match_points,
    total_round_goal_points = EXCLUDED.total_round_goal_points,
    exact_score_bonuses = EXCLUDED.exact_score_bonuses,
    last_updated = EXCLUDED.last_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;
