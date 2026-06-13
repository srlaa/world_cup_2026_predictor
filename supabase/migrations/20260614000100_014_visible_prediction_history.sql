-- Reveal another player's predictions only after the relevant match or round
-- has started. SECURITY DEFINER avoids broadening direct table RLS access.
CREATE OR REPLACE FUNCTION public.get_visible_match_predictions(target_user_id uuid)
RETURNS TABLE (
  prediction_id uuid,
  match_id uuid,
  home_team text,
  away_team text,
  kickoff_at timestamptz,
  round match_round,
  status match_status,
  home_score integer,
  away_score integer,
  exact_score_enabled boolean,
  predicted_outcome character,
  predicted_home_score integer,
  predicted_away_score integer,
  boost_used boolean,
  is_outcome_correct boolean,
  is_exact_score_correct boolean,
  points_awarded numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    m.id,
    m.home_team,
    m.away_team,
    m.kickoff_at,
    m.round,
    m.status,
    m.home_score,
    m.away_score,
    m.exact_score_enabled,
    p.predicted_outcome,
    p.predicted_home_score,
    p.predicted_away_score,
    p.boost_used,
    p.is_outcome_correct,
    p.is_exact_score_correct,
    p.points_awarded
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE auth.uid() IS NOT NULL
    AND p.user_id = target_user_id
    AND (target_user_id = auth.uid() OR m.kickoff_at <= now())
  ORDER BY m.kickoff_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_visible_round_goal_predictions(target_user_id uuid)
RETURNS TABLE (
  prediction_id uuid,
  round match_round,
  predicted_total_goals integer,
  actual_total_goals integer,
  points_awarded integer,
  round_started boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rg.id,
    rg.round,
    rg.predicted_total_goals,
    rg.actual_total_goals,
    rg.points_awarded,
    min(m.kickoff_at) <= now()
  FROM public.round_goals rg
  JOIN public.matches m ON m.round = rg.round
  WHERE auth.uid() IS NOT NULL
    AND rg.user_id = target_user_id
  GROUP BY rg.id
  HAVING target_user_id = auth.uid() OR min(m.kickoff_at) <= now()
  ORDER BY min(m.kickoff_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_visible_match_predictions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_visible_round_goal_predictions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_match_predictions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_round_goal_predictions(uuid) TO authenticated;
