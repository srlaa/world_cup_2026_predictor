/* Stable exact-score match selection and transparent odds metadata. */

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS exact_score_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS odds_source text NOT NULL DEFAULT 'rating_model_v1';

CREATE OR REPLACE FUNCTION public.refresh_exact_score_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET exact_score_enabled = round IN (
    'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final'
  );

  WITH ranked AS (
    SELECT
      id,
      round,
      row_number() OVER (
        PARTITION BY round
        ORDER BY md5(COALESCE(api_match_id, id::text))
      ) AS selection_number
    FROM public.matches
    WHERE round IN ('group_round_1', 'group_round_2', 'group_round_3', 'round_of_32')
  )
  UPDATE public.matches m
  SET exact_score_enabled = true
  FROM ranked r
  WHERE m.id = r.id
    AND r.selection_number <= CASE
      WHEN r.round IN ('group_round_1', 'group_round_2', 'group_round_3') THEN 6
      WHEN r.round = 'round_of_32' THEN 4
      ELSE 0
    END;
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

  IF target_match.exact_score_enabled THEN
    IF NEW.predicted_home_score IS NULL OR NEW.predicted_away_score IS NULL THEN
      RAISE EXCEPTION 'Exact-score prediction is required for this match';
    END IF;

    IF (NEW.predicted_home_score > NEW.predicted_away_score AND NEW.predicted_outcome <> '1')
      OR (NEW.predicted_home_score < NEW.predicted_away_score AND NEW.predicted_outcome <> '2')
      OR (NEW.predicted_home_score = NEW.predicted_away_score AND NEW.predicted_outcome <> 'X') THEN
      RAISE EXCEPTION 'Exact score must match the selected outcome';
    END IF;
  ELSE
    NEW.predicted_home_score := NULL;
    NEW.predicted_away_score := NULL;
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

SELECT public.refresh_exact_score_matches();

REVOKE ALL ON FUNCTION public.refresh_exact_score_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_exact_score_matches() TO service_role;
