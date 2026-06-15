/* Lock the first available market odds and make Fireball exactly double integer base points. */

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS locked_odds_home numeric(6,2),
  ADD COLUMN IF NOT EXISTS locked_odds_draw numeric(6,2),
  ADD COLUMN IF NOT EXISTS locked_odds_away numeric(6,2),
  ADD COLUMN IF NOT EXISTS locked_odds_source text,
  ADD COLUMN IF NOT EXISTS odds_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.freeze_match_odds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.odds_locked_at IS NOT NULL THEN
    NEW.locked_odds_home := OLD.locked_odds_home;
    NEW.locked_odds_draw := OLD.locked_odds_draw;
    NEW.locked_odds_away := OLD.locked_odds_away;
    NEW.locked_odds_source := OLD.locked_odds_source;
    NEW.odds_locked_at := OLD.odds_locked_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_match_odds_trigger ON public.matches;
CREATE TRIGGER freeze_match_odds_trigger
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.freeze_match_odds();

UPDATE public.matches
SET
  locked_odds_home = odds_home,
  locked_odds_draw = odds_draw,
  locked_odds_away = odds_away,
  locked_odds_source = odds_source,
  odds_locked_at = COALESCE(odds_updated_at, kickoff_at, now())
WHERE odds_source LIKE 'the_odds_api_%'
  AND odds_locked_at IS NULL;

CREATE OR REPLACE FUNCTION public.require_locked_market_odds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  market_odds_locked boolean;
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  SELECT m.odds_locked_at IS NOT NULL AND m.locked_odds_source LIKE 'the_odds_api_%'
  INTO market_odds_locked
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF NOT COALESCE(market_odds_locked, false) THEN
    RAISE EXCEPTION 'Market odds are not available for this match yet';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_locked_market_odds_trigger ON public.predictions;
CREATE TRIGGER require_locked_market_odds_trigger
  BEFORE INSERT OR UPDATE OF predicted_outcome, predicted_home_score, predicted_away_score,
    predicted_advancing_team, boost_used ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.require_locked_market_odds();

CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.predictions p
  SET is_outcome_correct = false, is_exact_score_correct = false,
      is_advancer_correct = false, advancement_points = 0, points_awarded = 0, updated_at = now()
  FROM public.matches m
  WHERE p.match_id = m.id
    AND (m.status <> 'finished' OR m.home_score IS NULL OR m.away_score IS NULL)
    AND (p.is_outcome_correct OR p.is_exact_score_correct OR p.is_advancer_correct OR p.points_awarded <> 0);

  UPDATE public.predictions p
  SET
    is_outcome_correct = p.predicted_outcome = CASE WHEN m.home_score > m.away_score THEN '1' WHEN m.home_score < m.away_score THEN '2' ELSE 'X' END,
    is_exact_score_correct = p.predicted_home_score IS NOT NULL
      AND p.predicted_home_score = m.home_score AND p.predicted_away_score = m.away_score,
    is_advancer_correct = p.predicted_advancing_team IS NOT NULL AND p.predicted_advancing_team = m.winner_team,
    advancement_points = CASE
      WHEN p.predicted_advancing_team IS NULL OR p.predicted_advancing_team <> m.winner_team THEN 0
      WHEN m.home_score = m.away_score AND p.predicted_outcome = 'X' THEN 20
      WHEN m.home_score = m.away_score AND p.predicted_outcome IN ('1', '2') THEN 8
      ELSE 0
    END,
    points_awarded =
      CASE
        WHEN p.predicted_outcome = CASE WHEN m.home_score > m.away_score THEN '1' WHEN m.home_score < m.away_score THEN '2' ELSE 'X' END
        THEN ceil(
          (CASE p.predicted_outcome
            WHEN '1' THEN COALESCE(m.locked_odds_home, m.odds_home) * 10
            WHEN 'X' THEN COALESCE(m.locked_odds_draw, m.odds_draw) * 10
            ELSE COALESCE(m.locked_odds_away, m.odds_away) * 10
          END) * public.round_points_multiplier(m.round)
        ) * CASE WHEN p.boost_used THEN 2 ELSE 1 END
        ELSE 0
      END
      + CASE WHEN p.predicted_home_score IS NOT NULL AND p.predicted_home_score = m.home_score AND p.predicted_away_score = m.away_score THEN 50 ELSE 0 END
      + CASE
        WHEN p.predicted_advancing_team IS NULL OR p.predicted_advancing_team <> m.winner_team THEN 0
        WHEN m.home_score = m.away_score AND p.predicted_outcome = 'X' THEN 20
        WHEN m.home_score = m.away_score AND p.predicted_outcome IN ('1', '2') THEN 8
        ELSE 0
      END,
    updated_at = now()
  FROM public.matches m
  WHERE p.match_id = m.id AND m.status = 'finished' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL;

  UPDATE public.round_goals rg
  SET actual_total_goals = NULL, points_awarded = NULL, updated_at = now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.round = rg.round AND m.status <> 'cancelled'
    GROUP BY m.round HAVING count(*) > 0 AND bool_and(m.status = 'finished')
      AND bool_and(m.home_score IS NOT NULL AND m.away_score IS NOT NULL)
  ) AND (rg.actual_total_goals IS NOT NULL OR rg.points_awarded IS NOT NULL);

  WITH completed_rounds AS (
    SELECT round, sum(home_score + away_score)::integer AS total_goals
    FROM public.matches WHERE status <> 'cancelled'
    GROUP BY round HAVING count(*) > 0 AND bool_and(status = 'finished')
      AND bool_and(home_score IS NOT NULL AND away_score IS NOT NULL)
  )
  UPDATE public.round_goals rg
  SET actual_total_goals = cr.total_goals,
      points_awarded = greatest(0, 100 - abs(rg.predicted_total_goals - cr.total_goals) * 2), updated_at = now()
  FROM completed_rounds cr WHERE rg.round = cr.round;

  INSERT INTO public.user_scores (user_id, total_match_points, total_round_goal_points, exact_score_bonuses, last_updated)
  SELECT p.id,
    COALESCE((SELECT sum(pr.points_awarded) FROM public.predictions pr WHERE pr.user_id = p.id), 0),
    COALESCE((SELECT sum(rg.points_awarded) FROM public.round_goals rg WHERE rg.user_id = p.id), 0),
    COALESCE((SELECT count(*) FROM public.predictions pr WHERE pr.user_id = p.id AND pr.is_exact_score_correct), 0), now()
  FROM public.profiles p
  ON CONFLICT (user_id) DO UPDATE SET total_match_points = EXCLUDED.total_match_points,
    total_round_goal_points = EXCLUDED.total_round_goal_points,
    exact_score_bonuses = EXCLUDED.exact_score_bonuses, last_updated = EXCLUDED.last_updated;
END;
$$;

SELECT public.recalculate_all_scores();

REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;

-- Newly discovered knockout pairings request odds immediately from update-scores.
-- This daily job is only a fallback for pairings whose market was not available yet.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-world-cup-odds';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'sync-world-cup-odds',
    '23 6 * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/sync-odds',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
    $job$
  );
END
$$;
