/* Free dynamic odds model based on initial team strength and tournament form. */

CREATE TABLE IF NOT EXISTS public.team_ratings (
  team_name text PRIMARY KEY,
  initial_rating numeric(8,2) NOT NULL,
  current_rating numeric(8,2) NOT NULL,
  matches_processed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_ratings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.team_ratings (team_name, initial_rating, current_rating) VALUES
  ('Argentina', 2000, 2000), ('Spain', 1980, 1980), ('France', 1960, 1960),
  ('England', 1930, 1930), ('Brazil', 1920, 1920), ('Portugal', 1900, 1900),
  ('Netherlands', 1880, 1880), ('Germany', 1870, 1870), ('Morocco', 1840, 1840),
  ('Colombia', 1830, 1830), ('Uruguay', 1820, 1820), ('Croatia', 1800, 1800),
  ('Belgium', 1790, 1790), ('Switzerland', 1770, 1770), ('Japan', 1760, 1760),
  ('Mexico', 1740, 1740), ('United States', 1730, 1730), ('Senegal', 1720, 1720),
  ('Iran', 1710, 1710), ('Austria', 1690, 1690), ('Turkey', 1680, 1680),
  ('Ecuador', 1680, 1680), ('South Korea', 1660, 1660), ('Australia', 1640, 1640),
  ('Canada', 1630, 1630), ('Norway', 1620, 1620), ('Sweden', 1600, 1600),
  ('Ivory Coast', 1600, 1600), ('Algeria', 1590, 1590), ('Egypt', 1580, 1580),
  ('Paraguay', 1570, 1570), ('Tunisia', 1560, 1560), ('Scotland', 1550, 1550),
  ('Panama', 1540, 1540), ('South Africa', 1530, 1530), ('Czechia', 1520, 1520),
  ('Qatar', 1500, 1500), ('Saudi Arabia', 1490, 1490), ('Uzbekistan', 1480, 1480),
  ('Congo DR', 1470, 1470), ('Ghana', 1460, 1460),
  ('Cape Verde Islands', 1450, 1450), ('Iraq', 1440, 1440), ('Jordan', 1430, 1430),
  ('New Zealand', 1410, 1410), ('Bosnia-Herzegovina', 1400, 1400),
  ('Curaçao', 1360, 1360), ('Haiti', 1340, 1340)
ON CONFLICT (team_name) DO UPDATE SET
  initial_rating = EXCLUDED.initial_rating;

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
    SELECT current_rating INTO home_rating
    FROM public.team_ratings WHERE team_name = played_match.home_team;
    SELECT current_rating INTO away_rating
    FROM public.team_ratings WHERE team_name = played_match.away_team;

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
      AND m.odds_source NOT LIKE 'api_football_%'
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

SELECT public.refresh_dynamic_model_odds();
