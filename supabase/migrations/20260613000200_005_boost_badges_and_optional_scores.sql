/* Boost badges, optional exact-score picks, and knockout-round multipliers. */

ALTER TABLE public.predictions
  ALTER COLUMN predicted_home_score DROP NOT NULL,
  ALTER COLUMN predicted_away_score DROP NOT NULL;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS boost_used boolean NOT NULL DEFAULT false;

ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_predicted_home_score_check,
  DROP CONSTRAINT IF EXISTS predictions_predicted_away_score_check;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_home_score_nonnegative
    CHECK (predicted_home_score IS NULL OR predicted_home_score >= 0),
  ADD CONSTRAINT predictions_away_score_nonnegative
    CHECK (predicted_away_score IS NULL OR predicted_away_score >= 0),
  ADD CONSTRAINT predictions_score_pair
    CHECK ((predicted_home_score IS NULL) = (predicted_away_score IS NULL));

CREATE OR REPLACE FUNCTION public.boost_limit_for_round(target_round match_round)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE target_round
    WHEN 'group_round_1' THEN 6
    WHEN 'group_round_2' THEN 6
    WHEN 'group_round_3' THEN 6
    WHEN 'round_of_32' THEN 4
    WHEN 'round_of_16' THEN 2
    WHEN 'quarter_finals' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.round_points_multiplier(target_round match_round)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE target_round
    WHEN 'quarter_finals' THEN 1.5
    WHEN 'semi_finals' THEN 2
    WHEN 'final' THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.protect_prediction_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_match public.matches%ROWTYPE;
  used_boosts integer;
  boost_limit integer;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO target_match FROM public.matches WHERE id = NEW.match_id;
  IF target_match.id IS NULL OR target_match.kickoff_at <= now() THEN
    RAISE EXCEPTION 'Predictions are locked after kickoff';
  END IF;

  IF (NEW.predicted_home_score IS NULL) <> (NEW.predicted_away_score IS NULL) THEN
    RAISE EXCEPTION 'Both exact-score values must be provided together';
  END IF;

  IF target_match.round IN (
    'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final'
  ) AND NEW.predicted_home_score IS NULL THEN
    RAISE EXCEPTION 'Exact-score prediction is required from the round of 16 onward';
  END IF;

  IF NEW.predicted_home_score IS NOT NULL THEN
    IF (NEW.predicted_home_score > NEW.predicted_away_score AND NEW.predicted_outcome <> '1')
      OR (NEW.predicted_home_score < NEW.predicted_away_score AND NEW.predicted_outcome <> '2')
      OR (NEW.predicted_home_score = NEW.predicted_away_score AND NEW.predicted_outcome <> 'X') THEN
      RAISE EXCEPTION 'Exact score must match the selected outcome';
    END IF;
  END IF;

  boost_limit := public.boost_limit_for_round(target_match.round);
  IF NEW.boost_used THEN
    IF boost_limit = 0 THEN
      RAISE EXCEPTION 'Boost badges are not available in this round';
    END IF;

    SELECT count(*) INTO used_boosts
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = auth.uid()
      AND m.round = target_match.round
      AND p.boost_used
      AND (TG_OP = 'INSERT' OR p.id <> OLD.id);

    IF used_boosts >= boost_limit THEN
      RAISE EXCEPTION 'All boost badges for this round have been used';
    END IF;
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
    is_exact_score_correct = p.predicted_home_score IS NOT NULL
      AND p.predicted_home_score = m.home_score
      AND p.predicted_away_score = m.away_score,
    points_awarded =
      CASE
        WHEN p.predicted_outcome = CASE
          WHEN m.home_score > m.away_score THEN '1'
          WHEN m.home_score < m.away_score THEN '2'
          ELSE 'X'
        END
        THEN
          CASE p.predicted_outcome
            WHEN '1' THEN m.odds_home * 10
            WHEN 'X' THEN m.odds_draw * 10
            ELSE m.odds_away * 10
          END
          * public.round_points_multiplier(m.round)
          * CASE WHEN p.boost_used THEN 2 ELSE 1 END
        ELSE 0
      END
      + CASE
          WHEN p.predicted_home_score IS NOT NULL
            AND p.predicted_home_score = m.home_score
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
    SELECT round, sum(home_score + away_score)::int AS total_goals
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
    user_id, total_match_points, total_round_goal_points, exact_score_bonuses, last_updated
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

REVOKE ALL ON FUNCTION public.boost_limit_for_round(match_round) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.round_points_multiplier(match_round) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boost_limit_for_round(match_round) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.round_points_multiplier(match_round) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;
