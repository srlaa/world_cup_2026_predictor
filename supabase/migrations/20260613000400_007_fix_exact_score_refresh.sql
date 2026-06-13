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
  )
  WHERE exact_score_enabled IS DISTINCT FROM (
    round IN ('round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final')
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
    AND NOT m.exact_score_enabled
    AND r.selection_number <= CASE
      WHEN r.round IN ('group_round_1', 'group_round_2', 'group_round_3') THEN 6
      WHEN r.round = 'round_of_32' THEN 4
      ELSE 0
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_exact_score_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_exact_score_matches() TO service_role;
