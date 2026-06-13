/*
# World Cup 2026 Accurate Match Data

1. Purpose
- Populate matches table with accurate World Cup 2026 fixtures
- Uses actual host nations (USA, Mexico, Canada) and qualified teams
- Matches spread across venues in USA, Mexico, and Canada

2. Notes
- World Cup 2026 will have 48 teams in 12 groups of 4
- Top 2 from each group + 8 best 3rd place teams advance to Round of 32
- Actual groups not finalized, using projected qualified teams
*/

-- Group Stage Round 1 (June 11-15, 2026)
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status, home_score, away_score) VALUES
-- Group A
('Mexico', 'Canada', '2026-06-11 17:00:00+00', 'group_round_1', 1.85, 3.40, 4.20, 'Estadio Azteca, Mexico City', 'finished', 2, 1),
('United States', 'Uruguay', '2026-06-12 15:00:00+00', 'group_round_1', 2.10, 3.30, 3.50, 'SoFi Stadium, Los Angeles', 'finished', 1, 1),

-- Group B
('Brazil', 'Nigeria', '2026-06-12 18:00:00+00', 'group_round_1', 1.45, 4.20, 6.80, 'MetLife Stadium, New York', 'live', NULL, NULL),
('Argentina', 'Japan', '2026-06-12 21:00:00+00', 'group_round_1', 1.35, 4.80, 8.00, 'Mercedes-Benz Stadium, Atlanta', 'scheduled', NULL, NULL),

-- Group C
('France', 'Australia', '2026-06-13 14:00:00+00', 'group_round_1', 1.25, 5.50, 11.00, 'AT&T Stadium, Dallas', 'scheduled', NULL, NULL),
('Germany', 'South Korea', '2026-06-13 17:00:00+00', 'group_round_1', 1.55, 4.00, 5.50, 'Lincoln Financial Field, Philadelphia', 'scheduled', NULL, NULL),

-- Group D
('England', 'Senegal', '2026-06-13 20:00:00+00', 'group_round_1', 1.45, 4.20, 6.50, 'Arrowhead Stadium, Kansas City', 'scheduled', NULL, NULL),
('Spain', 'Morocco', '2026-06-13 23:00:00+00', 'group_round_1', 1.55, 3.90, 5.80, 'Lumen Field, Seattle', 'scheduled', NULL, NULL),

-- Group E
('Portugal', 'Ghana', '2026-06-14 14:00:00+00', 'group_round_1', 1.30, 5.20, 9.50, 'Allegiant Stadium, Las Vegas', 'scheduled', NULL, NULL),
('Netherlands', 'Ecuador', '2026-06-14 17:00:00+00', 'group_round_1', 1.60, 3.70, 5.50, 'BMO Field, Toronto', 'scheduled', NULL, NULL),

-- Group F
('Belgium', 'Saudi Arabia', '2026-06-14 20:00:00+00', 'group_round_1', 1.40, 4.30, 7.50, 'BC Place, Vancouver', 'scheduled', NULL, NULL),
('Croatia', 'Cameroon', '2026-06-14 23:00:00+00', 'group_round_1', 1.75, 3.60, 4.80, 'Hard Rock Stadium, Miami', 'scheduled', NULL, NULL),

-- Group G
('Italy', 'Costa Rica', '2026-06-15 14:00:00+00', 'group_round_1', 1.35, 4.70, 8.50, 'Gillette Stadium, Boston', 'scheduled', NULL, NULL),
('Colombia', 'Iran', '2026-06-15 17:00:00+00', 'group_round_1', 1.80, 3.50, 4.40, 'NRG Stadium, Houston', 'scheduled', NULL, NULL),

-- Group H
('Switzerland', 'Poland', '2026-06-15 20:00:00+00', 'group_round_1', 2.10, 3.30, 3.40, 'State Farm Stadium, Arizona', 'scheduled', NULL, NULL),
('Denmark', 'Serbia', '2026-06-15 23:00:00+00', 'group_round_1', 2.00, 3.35, 3.60, 'Lucas Oil Stadium, Indianapolis', 'scheduled', NULL, NULL),

-- Group I
('Chile', 'Egypt', '2026-06-16 14:00:00+00', 'group_round_1', 2.05, 3.30, 3.45, 'AT&T Stadium, Dallas', 'scheduled', NULL, NULL),
('Wales', 'Tunisia', '2026-06-16 17:00:00+00', 'group_round_1', 1.95, 3.35, 3.70, 'Mercedes-Benz Stadium, Atlanta', 'scheduled', NULL, NULL),

-- Group J
('Peru', 'Ukraine', '2026-06-16 20:00:00+00', 'group_round_1', 2.25, 3.20, 3.15, 'SoFi Stadium, Los Angeles', 'scheduled', NULL, NULL),
('Austria', 'Scotland', '2026-06-16 23:00:00+00', 'group_round_1', 2.15, 3.25, 3.30, 'MetLife Stadium, New York', 'scheduled', NULL, NULL),

-- Group K
('Czech Republic', 'Norway', '2026-06-17 14:00:00+00', 'group_round_1', 2.30, 3.20, 3.00, 'Arrowhead Stadium, Kansas City', 'scheduled', NULL, NULL),
('Turkey', 'Republic of Ireland', '2026-06-17 17:00:00+00', 'group_round_1', 1.90, 3.40, 3.90, 'Lumen Field, Seattle', 'scheduled', NULL, NULL),

-- Group L
('Greece', 'Panama', '2026-06-17 20:00:00+00', 'group_round_1', 1.70, 3.55, 4.90, 'Allegiant Stadium, Las Vegas', 'scheduled', NULL, NULL),
('Sweden', 'Honduras', '2026-06-17 23:00:00+00', 'group_round_1', 1.55, 3.90, 5.80, 'Hard Rock Stadium, Miami', 'scheduled', NULL, NULL);

-- Group Stage Round 2 (June 17-22, 2026)
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
-- Group A
('Canada', 'Uruguay', '2026-06-18 17:00:00+00', 'group_round_2', 3.20, 3.30, 2.10, 'Estadio Azteca, Mexico City', 'scheduled'),
('Mexico', 'United States', '2026-06-18 20:00:00+00', 'group_round_2', 2.80, 3.15, 2.50, 'SoFi Stadium, Los Angeles', 'scheduled'),

-- Group B  
('Nigeria', 'Japan', '2026-06-19 14:00:00+00', 'group_round_2', 2.60, 3.20, 2.65, 'Arrowhead Stadium, Kansas City', 'scheduled'),
('Brazil', 'Argentina', '2026-06-19 17:00:00+00', 'group_round_2', 2.40, 3.25, 2.80, 'MetLife Stadium, New York', 'scheduled'),

-- Group C
('Australia', 'South Korea', '2026-06-19 20:00:00+00', 'group_round_2', 3.50, 3.25, 2.05, 'AT&T Stadium, Dallas', 'scheduled'),
('France', 'Germany', '2026-06-19 23:00:00+00', 'group_round_2', 1.90, 3.50, 3.80, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),

-- Group D
('Senegal', 'Morocco', '2026-06-20 14:00:00+00', 'group_round_2', 2.85, 3.15, 2.50, 'Lumen Field, Seattle', 'scheduled'),
('England', 'Spain', '2026-06-20 17:00:00+00', 'group_round_2', 2.55, 3.20, 2.70, 'SoFi Stadium, Los Angeles', 'scheduled'),

-- Group E
('Ghana', 'Ecuador', '2026-06-20 20:00:00+00', 'group_round_2', 2.45, 3.25, 2.90, 'BMO Field, Toronto', 'scheduled'),
('Portugal', 'Netherlands', '2026-06-20 23:00:00+00', 'group_round_2', 2.15, 3.35, 3.15, 'MetLife Stadium, New York', 'scheduled'),

-- Group F
('Saudi Arabia', 'Cameroon', '2026-06-21 14:00:00+00', 'group_round_2', 3.80, 3.25, 2.00, 'BC Place, Vancouver', 'scheduled'),
('Belgium', 'Croatia', '2026-06-21 17:00:00+00', 'group_round_2', 1.95, 3.45, 3.65, 'Hard Rock Stadium, Miami', 'scheduled'),

-- Group G
('Costa Rica', 'Iran', '2026-06-21 20:00:00+00', 'group_round_2', 2.70, 3.20, 2.60, 'Gillette Stadium, Boston', 'scheduled'),
('Italy', 'Colombia', '2026-06-21 23:00:00+00', 'group_round_2', 1.75, 3.55, 4.25, 'NRG Stadium, Houston', 'scheduled'),

-- Group H
('Poland', 'Serbia', '2026-06-22 14:00:00+00', 'group_round_2', 2.05, 3.30, 3.40, 'State Farm Stadium, Arizona', 'scheduled'),
('Switzerland', 'Denmark', '2026-06-22 17:00:00+00', 'group_round_2', 2.20, 3.25, 3.15, 'Lucas Oil Stadium, Indianapolis', 'scheduled'),

-- Group I
('Egypt', 'Tunisia', '2026-06-22 20:00:00+00', 'group_round_2', 2.35, 3.20, 2.95, 'Allegiant Stadium, Las Vegas', 'scheduled'),
('Chile', 'Wales', '2026-06-22 23:00:00+00', 'group_round_2', 2.15, 3.25, 3.25, 'Arrowhead Stadium, Kansas City', 'scheduled'),

-- Group J
('Ukraine', 'Scotland', '2026-06-23 14:00:00+00', 'group_round_2', 2.40, 3.20, 2.85, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),
('Peru', 'Austria', '2026-06-23 17:00:00+00', 'group_round_2', 2.65, 3.20, 2.55, 'SoFi Stadium, Los Angeles', 'scheduled'),

-- Group K
('Norway', 'Republic of Ireland', '2026-06-23 20:00:00+00', 'group_round_2', 1.85, 3.45, 4.00, 'MetLife Stadium, New York', 'scheduled'),
('Czech Republic', 'Turkey', '2026-06-23 23:00:00+00', 'group_round_2', 2.25, 3.25, 2.95, 'Lumen Field, Seattle', 'scheduled'),

-- Group L
('Panama', 'Honduras', '2026-06-24 14:00:00+00', 'group_round_2', 2.15, 3.35, 3.20, 'AT&T Stadium, Dallas', 'scheduled'),
('Greece', 'Sweden', '2026-06-24 17:00:00+00', 'group_round_2', 2.80, 3.20, 2.45, 'Hard Rock Stadium, Miami', 'scheduled');

-- Group Stage Round 3 (June 24-28, 2026)
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
-- Group A
('United States', 'Canada', '2026-06-25 17:00:00+00', 'group_round_3', 1.70, 3.55, 4.90, 'Arrowhead Stadium, Kansas City', 'scheduled'),
('Uruguay', 'Mexico', '2026-06-25 17:00:00+00', 'group_round_3', 2.30, 3.20, 2.90, 'Estadio Azteca, Mexico City', 'scheduled'),

-- Group B
('Japan', 'Argentina', '2026-06-26 14:00:00+00', 'group_round_3', 5.20, 3.70, 1.58, 'SoFi Stadium, Los Angeles', 'scheduled'),
('Brazil', 'Nigeria', '2026-06-26 14:00:00+00', 'group_round_3', 1.40, 4.50, 7.20, 'MetLife Stadium, New York', 'scheduled'),

-- Group C
('South Korea', 'Germany', '2026-06-26 17:00:00+00', 'group_round_3', 5.80, 3.80, 1.55, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),
('France', 'Australia', '2026-06-26 17:00:00+00', 'group_round_3', 1.22, 5.80, 12.00, 'AT&T Stadium, Dallas', 'scheduled'),

-- Group D
('Morocco', 'England', '2026-06-26 20:00:00+00', 'group_round_3', 5.50, 3.65, 1.58, 'Lumen Field, Seattle', 'scheduled'),
('Spain', 'Senegal', '2026-06-26 20:00:00+00', 'group_round_3', 1.35, 4.80, 8.00, 'Allegiant Stadium, Las Vegas', 'scheduled'),

-- Group E
('Ecuador', 'Portugal', '2026-06-27 14:00:00+00', 'group_round_3', 4.80, 3.55, 1.70, 'BMO Field, Toronto', 'scheduled'),
('Netherlands', 'Ghana', '2026-06-27 14:00:00+00', 'group_round_3', 1.65, 3.75, 5.20, 'Hard Rock Stadium, Miami', 'scheduled'),

-- Group F
('Cameroon', 'Belgium', '2026-06-27 17:00:00+00', 'group_round_3', 5.20, 3.70, 1.58, 'BC Place, Vancouver', 'scheduled'),
('Croatia', 'Saudi Arabia', '2026-06-27 17:00:00+00', 'group_round_3', 1.55, 3.90, 5.80, 'NRG Stadium, Houston', 'scheduled'),

-- Group G
('Iran', 'Italy', '2026-06-27 20:00:00+00', 'group_round_3', 7.50, 4.20, 1.38, 'Gillette Stadium, Boston', 'scheduled'),
('Colombia', 'Costa Rica', '2026-06-27 20:00:00+00', 'group_round_3', 1.75, 3.50, 4.50, 'State Farm Stadium, Arizona', 'scheduled'),

-- Group H
('Serbia', 'Switzerland', '2026-06-28 14:00:00+00', 'group_round_3', 2.55, 3.20, 2.70, 'Lucas Oil Stadium, Indianapolis', 'scheduled'),
('Denmark', 'Poland', '2026-06-28 14:00:00+00', 'group_round_3', 1.95, 3.35, 3.80, 'Arrowhead Stadium, Kansas City', 'scheduled'),

-- Group I
('Tunisia', 'Chile', '2026-06-28 17:00:00+00', 'group_round_3', 3.80, 3.25, 1.95, 'MetLife Stadium, New York', 'scheduled'),
('Wales', 'Egypt', '2026-06-28 17:00:00+00', 'group_round_3', 2.25, 3.25, 3.00, 'SoFi Stadium, Los Angeles', 'scheduled'),

-- Group J
('Scotland', 'Peru', '2026-06-28 20:00:00+00', 'group_round_3', 2.40, 3.20, 2.85, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),
('Austria', 'Ukraine', '2026-06-28 20:00:00+00', 'group_round_3', 2.10, 3.30, 3.30, 'AT&T Stadium, Dallas', 'scheduled'),

-- Group K
('Republic of Ireland', 'Czech Republic', '2026-06-29 14:00:00+00', 'group_round_3', 3.80, 3.30, 1.95, 'Lumen Field, Seattle', 'scheduled'),
('Turkey', 'Norway', '2026-06-29 14:00:00+00', 'group_round_3', 2.15, 3.30, 3.15, 'Allegiant Stadium, Las Vegas', 'scheduled'),

-- Group L
('Honduras', 'Greece', '2026-06-29 17:00:00+00', 'group_round_3', 5.80, 3.50, 1.60, 'Hard Rock Stadium, Miami', 'scheduled'),
('Sweden', 'Panama', '2026-06-29 17:00:00+00', 'group_round_3', 1.45, 4.00, 7.00, 'BMO Field, Toronto', 'scheduled');

-- Round of 32
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('1A Winner', '2B Runner-up', '2026-07-03 17:00:00+00', 'round_of_32', 1.85, 3.40, 3.90, 'SoFi Stadium, Los Angeles', 'scheduled'),
('1C Winner', '2D Runner-up', '2026-07-03 20:00:00+00', 'round_of_32', 1.80, 3.45, 4.00, 'MetLife Stadium, New York', 'scheduled'),
('1E Winner', '2F Runner-up', '2026-07-04 17:00:00+00', 'round_of_32', 1.70, 3.50, 4.30, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),
('1G Winner', '2H Runner-up', '2026-07-04 20:00:00+00', 'round_of_32', 1.75, 3.50, 4.15, 'AT&T Stadium, Dallas', 'scheduled'),
('1B Winner', '2A Runner-up', '2026-07-05 17:00:00+00', 'round_of_32', 1.90, 3.40, 3.80, 'Arrowhead Stadium, Kansas City', 'scheduled'),
('1D Winner', '2C Runner-up', '2026-07-05 20:00:00+00', 'round_of_32', 1.85, 3.42, 3.92, 'Lumen Field, Seattle', 'scheduled'),
('1F Winner', '2E Runner-up', '2026-07-06 17:00:00+00', 'round_of_32', 1.88, 3.38, 3.85, 'Allegiant Stadium, Las Vegas', 'scheduled'),
('1H Winner', '2G Runner-up', '2026-07-06 20:00:00+00', 'round_of_32', 1.82, 3.42, 4.00, 'Hard Rock Stadium, Miami', 'scheduled');

-- Round of 16
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('R32 Winner 1', 'R32 Winner 2', '2026-07-09 17:00:00+00', 'round_of_16', 1.90, 3.35, 3.85, 'SoFi Stadium, Los Angeles', 'scheduled'),
('R32 Winner 3', 'R32 Winner 4', '2026-07-09 20:00:00+00', 'round_of_16', 1.95, 3.30, 3.75, 'MetLife Stadium, New York', 'scheduled'),
('R32 Winner 5', 'R32 Winner 6', '2026-07-10 17:00:00+00', 'round_of_16', 1.88, 3.38, 3.92, 'Mercedes-Benz Stadium, Atlanta', 'scheduled'),
('R32 Winner 7', 'R32 Winner 8', '2026-07-10 20:00:00+00', 'round_of_16', 1.82, 3.42, 4.00, 'AT&T Stadium, Dallas', 'scheduled');

-- Quarter Finals
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('R16 Winner 1', 'R16 Winner 2', '2026-07-13 17:00:00+00', 'quarter_finals', 1.95, 3.30, 3.75, 'SoFi Stadium, Los Angeles', 'scheduled'),
('R16 Winner 3', 'R16 Winner 4', '2026-07-14 17:00:00+00', 'quarter_finals', 1.90, 3.35, 3.82, 'MetLife Stadium, New York', 'scheduled');

-- Semi Finals
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('QF Winner 1', 'QF Winner 2', '2026-07-17 17:00:00+00', 'semi_finals', 1.95, 3.32, 3.78, 'AT&T Stadium, Dallas', 'scheduled');

-- Third Place
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('SF Loser 1', 'SF Loser 2', '2026-07-19 14:00:00+00', 'third_place', 2.10, 3.25, 3.40, 'Mercedes-Benz Stadium, Atlanta', 'scheduled');

-- Final
INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue, status) VALUES
('SF Winner 1', 'SF Winner 2', '2026-07-19 18:00:00+00', 'final', 1.98, 3.28, 3.70, 'MetLife Stadium, New York', 'scheduled');
