/* Normalize predictions created while knockout winner was an independent pick. */

UPDATE public.predictions p
SET predicted_advancing_team = CASE p.predicted_outcome
  WHEN '1' THEN m.home_team
  WHEN '2' THEN m.away_team
  ELSE p.predicted_advancing_team
END,
updated_at = now()
FROM public.matches m
WHERE p.match_id = m.id
  AND public.requires_advancer_pick(m.round)
  AND p.predicted_outcome IN ('1', '2')
  AND p.predicted_advancing_team IS DISTINCT FROM CASE p.predicted_outcome
    WHEN '1' THEN m.home_team
    ELSE m.away_team
  END;

SELECT public.recalculate_all_scores();
