/* Final tournament rules: 90-minute picks, knockout winners, stable exact-score games. */

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS final_home_score integer,
  ADD COLUMN IF NOT EXISTS final_away_score integer,
  ADD COLUMN IF NOT EXISTS score_duration text,
  ADD COLUMN IF NOT EXISTS winner_team text;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_score_duration_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_score_duration_check
    CHECK (score_duration IS NULL OR score_duration IN ('REGULAR', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'));

UPDATE public.matches
SET
  final_home_score = COALESCE(final_home_score, home_score),
  final_away_score = COALESCE(final_away_score, away_score),
  score_duration = CASE WHEN status = 'finished' THEN COALESCE(score_duration, 'REGULAR') ELSE score_duration END,
  winner_team = CASE
    WHEN status = 'finished' AND home_score > away_score THEN home_team
    WHEN status = 'finished' AND away_score > home_score THEN away_team
    ELSE winner_team
  END;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS predicted_advancing_team text,
  ADD COLUMN IF NOT EXISTS is_advancer_correct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advancement_points integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.exact_score_round_selections (
  round match_round PRIMARY KEY,
  expected_matches integer NOT NULL CHECK (expected_matches > 0),
  selected_matches integer NOT NULL CHECK (selected_matches >= 0),
  finalized_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exact_score_round_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exact_score_selections_read" ON public.exact_score_round_selections;
CREATE POLICY "exact_score_selections_read" ON public.exact_score_round_selections FOR SELECT
  TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.requires_advancer_pick(target_round match_round)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT target_round IN ('round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final');
$$;

CREATE OR REPLACE FUNCTION public.refresh_exact_score_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_round match_round;
  expected_count integer;
  selection_count integer;
  available_count integer;
BEGIN
  UPDATE public.matches
  SET exact_score_enabled = true
  WHERE round IN ('round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final')
    AND NOT exact_score_enabled;

  FOREACH target_round IN ARRAY ARRAY[
    'group_round_1'::match_round,
    'group_round_2'::match_round,
    'group_round_3'::match_round,
    'round_of_32'::match_round
  ] LOOP
    expected_count := CASE WHEN target_round = 'round_of_32' THEN 16 ELSE 24 END;
    selection_count := CASE WHEN target_round = 'round_of_32' THEN 4 ELSE 6 END;

    IF EXISTS (SELECT 1 FROM public.exact_score_round_selections s WHERE s.round = target_round) THEN
      CONTINUE;
    END IF;

    SELECT count(*) INTO available_count FROM public.matches WHERE round = target_round;
    IF available_count < expected_count THEN
      CONTINUE;
    END IF;

    UPDATE public.matches SET exact_score_enabled = false WHERE round = target_round;

    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY md5(COALESCE(api_match_id, id::text))) AS position
      FROM public.matches
      WHERE round = target_round
    )
    UPDATE public.matches m
    SET exact_score_enabled = true
    FROM ranked r
    WHERE m.id = r.id AND r.position <= selection_count;

    INSERT INTO public.exact_score_round_selections (round, expected_matches, selected_matches)
    VALUES (target_round, expected_count, selection_count)
    ON CONFLICT (round) DO NOTHING;
  END LOOP;
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
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;

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
      RAISE EXCEPTION 'Exact score must match the selected 90-minute outcome';
    END IF;
  ELSE
    NEW.predicted_home_score := NULL;
    NEW.predicted_away_score := NULL;
  END IF;

  IF public.requires_advancer_pick(target_match.round) THEN
    IF NEW.predicted_advancing_team IS NULL
      OR NEW.predicted_advancing_team NOT IN (target_match.home_team, target_match.away_team) THEN
      RAISE EXCEPTION 'Select the team that will advance';
    END IF;
  ELSE
    NEW.predicted_advancing_team := NULL;
  END IF;

  boost_limit := public.boost_limit_for_round(target_match.round);
  IF NEW.boost_used THEN
    IF boost_limit = 0 THEN RAISE EXCEPTION 'Boost badges are not available in this round'; END IF;
    SELECT count(*) INTO used_boosts
    FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = auth.uid() AND m.round = target_match.round AND p.boost_used
      AND (TG_OP = 'INSERT' OR p.id <> OLD.id);
    IF used_boosts >= boost_limit THEN RAISE EXCEPTION 'All boost badges for this round have been used'; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.is_exact_score_correct := false;
    NEW.is_outcome_correct := false;
    NEW.is_advancer_correct := false;
    NEW.advancement_points := 0;
    NEW.points_awarded := 0;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.match_id := OLD.match_id;
    NEW.is_exact_score_correct := OLD.is_exact_score_correct;
    NEW.is_outcome_correct := OLD.is_outcome_correct;
    NEW.is_advancer_correct := OLD.is_advancer_correct;
    NEW.advancement_points := OLD.advancement_points;
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
    advancement_points = CASE WHEN p.predicted_advancing_team IS NOT NULL AND p.predicted_advancing_team = m.winner_team THEN 25 ELSE 0 END,
    points_awarded = ceil(CASE
      WHEN p.predicted_outcome = CASE WHEN m.home_score > m.away_score THEN '1' WHEN m.home_score < m.away_score THEN '2' ELSE 'X' END
      THEN (CASE p.predicted_outcome WHEN '1' THEN m.odds_home * 10 WHEN 'X' THEN m.odds_draw * 10 ELSE m.odds_away * 10 END)
        * public.round_points_multiplier(m.round) * CASE WHEN p.boost_used THEN 2 ELSE 1 END
      ELSE 0 END)
      + CASE WHEN p.predicted_home_score IS NOT NULL AND p.predicted_home_score = m.home_score AND p.predicted_away_score = m.away_score THEN 50 ELSE 0 END
      + CASE WHEN p.predicted_advancing_team IS NOT NULL AND p.predicted_advancing_team = m.winner_team THEN 25 ELSE 0 END,
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

DROP FUNCTION IF EXISTS public.get_visible_match_predictions(uuid);
CREATE FUNCTION public.get_visible_match_predictions(target_user_id uuid)
RETURNS TABLE (
  prediction_id uuid, match_id uuid, home_team text, away_team text, kickoff_at timestamptz,
  round match_round, status match_status, home_score integer, away_score integer,
  final_home_score integer, final_away_score integer, winner_team text, exact_score_enabled boolean,
  predicted_outcome character, predicted_home_score integer, predicted_away_score integer,
  predicted_advancing_team text, boost_used boolean, is_outcome_correct boolean,
  is_exact_score_correct boolean, is_advancer_correct boolean, advancement_points integer, points_awarded numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, m.id, m.home_team, m.away_team, m.kickoff_at, m.round, m.status,
    m.home_score, m.away_score, m.final_home_score, m.final_away_score, m.winner_team,
    m.exact_score_enabled, p.predicted_outcome, p.predicted_home_score, p.predicted_away_score,
    p.predicted_advancing_team, p.boost_used, p.is_outcome_correct, p.is_exact_score_correct,
    p.is_advancer_correct, p.advancement_points, p.points_awarded
  FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
  WHERE auth.uid() IS NOT NULL AND p.user_id = target_user_id
    AND (target_user_id = auth.uid() OR m.kickoff_at <= now())
  ORDER BY m.kickoff_at DESC;
$$;

SELECT public.refresh_exact_score_matches();
SELECT public.recalculate_all_scores();

REVOKE ALL ON FUNCTION public.requires_advancer_pick(match_round) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.requires_advancer_pick(match_round) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_exact_score_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_exact_score_matches() TO service_role;
REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;
REVOKE ALL ON FUNCTION public.get_visible_match_predictions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_match_predictions(uuid) TO authenticated;
