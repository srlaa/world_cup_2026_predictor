ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS odds_updated_at timestamptz;

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
    points_awarded = ceil(
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
    )
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

REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;

SELECT public.recalculate_all_scores();
