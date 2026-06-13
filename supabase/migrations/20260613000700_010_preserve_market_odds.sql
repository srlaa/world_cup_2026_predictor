CREATE OR REPLACE FUNCTION public.refresh_dynamic_model_odds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  played_match record;
  home_rating numeric;
  away_rating numeric;
  expected_home numeric;
  actual_home numeric;
  rating_change numeric;
  k_factor numeric;
  goal_factor numeric;
BEGIN
  INSERT INTO public.team_ratings (team_name, initial_rating, current_rating)
  SELECT team_name, 1500, 1500
  FROM (
    SELECT home_team AS team_name FROM public.matches
    UNION
    SELECT away_team AS team_name FROM public.matches
  ) teams
  ON CONFLICT (team_name) DO NOTHING;

  UPDATE public.team_ratings
  SET current_rating = initial_rating,
      matches_processed = 0,
      updated_at = now()
  WHERE current_rating IS DISTINCT FROM initial_rating OR matches_processed <> 0;

  FOR played_match IN
    SELECT home_team, away_team, home_score, away_score, round
    FROM public.matches
    WHERE status = 'finished'
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
    ORDER BY kickoff_at, id
  LOOP
    SELECT current_rating INTO home_rating FROM public.team_ratings WHERE team_name = played_match.home_team;
    SELECT current_rating INTO away_rating FROM public.team_ratings WHERE team_name = played_match.away_team;
    expected_home := 1 / (1 + power(10::numeric, (away_rating - home_rating) / 400));
    actual_home := CASE
      WHEN played_match.home_score > played_match.away_score THEN 1
      WHEN played_match.home_score < played_match.away_score THEN 0
      ELSE 0.5
    END;
    k_factor := CASE
      WHEN played_match.round IN ('semi_finals', 'third_place', 'final') THEN 32
      WHEN played_match.round IN ('round_of_32', 'round_of_16', 'quarter_finals') THEN 28
      ELSE 24
    END;
    goal_factor := 1 + least(abs(played_match.home_score - played_match.away_score), 3) * 0.12;
    rating_change := k_factor * goal_factor * (actual_home - expected_home);

    UPDATE public.team_ratings
    SET current_rating = current_rating + rating_change,
        matches_processed = matches_processed + 1,
        updated_at = now()
    WHERE team_name = played_match.home_team;
    UPDATE public.team_ratings
    SET current_rating = current_rating - rating_change,
        matches_processed = matches_processed + 1,
        updated_at = now()
    WHERE team_name = played_match.away_team;
  END LOOP;

  WITH probabilities AS (
    SELECT
      m.id,
      1 / (1 + power(10::numeric, (away.current_rating - home.current_rating) / 400)) AS home_share,
      greatest(0.16, 0.28 * exp(-abs(home.current_rating - away.current_rating) / 500)) AS draw_probability
    FROM public.matches m
    JOIN public.team_ratings home ON home.team_name = m.home_team
    JOIN public.team_ratings away ON away.team_name = m.away_team
    WHERE m.status = 'scheduled'
      AND m.kickoff_at > now()
      AND m.odds_source NOT LIKE 'the_odds_api_%'
  )
  UPDATE public.matches m
  SET
    odds_home = round((1 / ((1 - p.draw_probability) * p.home_share * 1.06))::numeric, 2),
    odds_draw = round((1 / (p.draw_probability * 1.06))::numeric, 2),
    odds_away = round((1 / ((1 - p.draw_probability) * (1 - p.home_share) * 1.06))::numeric, 2),
    odds_source = 'dynamic_elo_v1',
    odds_updated_at = now(),
    updated_at = now()
  FROM probabilities p
  WHERE m.id = p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dynamic_model_odds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dynamic_model_odds() TO service_role;
