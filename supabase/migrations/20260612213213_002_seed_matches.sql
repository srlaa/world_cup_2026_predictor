/*
# World Cup 2026 Sample Matches Seed Data

1. Purpose
- Populate matches table with sample World Cup 2026 fixtures
- Includes group stage matches (Rounds 1, 2, 3) for demonstration
- Includes knockout stage placeholder dates
- Realistic odds for each match outcome

2. Notes
- Dates set for June-July 2026
- Odds are representative and will be fixed before each round starts
- Venues are actual World Cup 2026 stadiums
*/

INSERT INTO matches (home_team, away_team, kickoff_at, round, odds_home, odds_draw, odds_away, venue) VALUES
-- Group Round 1
('United States', 'Wales', '2026-06-12 18:00:00+00', 'group_round_1', 1.85, 3.40, 4.20, 'SoFi Stadium, Los Angeles'),
('Mexico', 'Poland', '2026-06-12 21:00:00+00', 'group_round_1', 2.10, 3.30, 3.50, 'Estadio Azteca, Mexico City'),
('Argentina', 'Saudi Arabia', '2026-06-13 15:00:00+00', 'group_round_1', 1.15, 6.50, 15.00, 'AT&T Stadium, Dallas'),
('France', 'Australia', '2026-06-13 18:00:00+00', 'group_round_1', 1.25, 5.50, 11.00, 'MetLife Stadium, New York'),
('Spain', 'Costa Rica', '2026-06-13 21:00:00+00', 'group_round_1', 1.20, 5.80, 13.00, 'Lumen Field, Seattle'),
('Germany', 'Japan', '2026-06-14 15:00:00+00', 'group_round_1', 1.55, 4.00, 5.50, 'Lincoln Financial Field, Philadelphia'),
('Brazil', 'Serbia', '2026-06-14 18:00:00+00', 'group_round_1', 1.45, 4.20, 6.80, 'Mercedes-Benz Stadium, Atlanta'),
('England', 'Iran', '2026-06-14 21:00:00+00', 'group_round_1', 1.35, 4.80, 8.00, 'Arrowhead Stadium, Kansas City'),
('Portugal', 'Ghana', '2026-06-15 15:00:00+00', 'group_round_1', 1.30, 5.20, 9.50, 'Allegiant Stadium, Las Vegas'),
('Netherlands', 'Senegal', '2026-06-15 18:00:00+00', 'group_round_1', 1.65, 3.70, 5.00, 'BMO Field, Toronto'),
('Belgium', 'Canada', '2026-06-15 21:00:00+00', 'group_round_1', 1.80, 3.50, 4.50, 'BC Place, Vancouver'),
('Uruguay', 'South Korea', '2026-06-16 15:00:00+00', 'group_round_1', 1.90, 3.40, 4.00, 'Toyota Stadium, Dallas'),
('Switzerland', 'Cameroon', '2026-06-16 18:00:00+00', 'group_round_1', 1.75, 3.60, 4.80, 'Hard Rock Stadium, Miami'),
('Croatia', 'Morocco', '2026-06-16 21:00:00+00', 'group_round_1', 1.95, 3.30, 3.90, 'Gillette Stadium, Boston'),

-- Group Round 2
('Wales', 'Mexico', '2026-06-18 18:00:00+00', 'group_round_2', 3.20, 3.30, 2.15, 'Rose Bowl, Los Angeles'),
('Poland', 'United States', '2026-06-18 21:00:00+00', 'group_round_2', 3.40, 3.25, 2.10, 'Estadio Azteca, Mexico City'),
('Saudi Arabia', 'France', '2026-06-19 15:00:00+00', 'group_round_2', 12.50, 6.00, 1.18, 'AT&T Stadium, Dallas'),
('Australia', 'Argentina', '2026-06-19 18:00:00+00', 'group_round_2', 9.50, 5.20, 1.28, 'MetLife Stadium, New York'),
('Costa Rica', 'Germany', '2026-06-19 21:00:00+00', 'group_round_2', 10.00, 5.50, 1.25, 'Lincoln Financial Field, Philadelphia'),
('Japan', 'Spain', '2026-06-20 15:00:00+00', 'group_round_2', 5.80, 3.90, 1.60, 'Lumen Field, Seattle'),
('Serbia', 'England', '2026-06-20 18:00:00+00', 'group_round_2', 6.00, 3.80, 1.58, 'Arrowhead Stadium, Kansas City'),
('Iran', 'Brazil', '2026-06-20 21:00:00+00', 'group_round_2', 12.00, 6.20, 1.16, 'Mercedes-Benz Stadium, Atlanta'),
('Ghana', 'Netherlands', '2026-06-21 15:00:00+00', 'group_round_2', 7.50, 4.20, 1.42, 'BMO Field, Toronto'),
('Senegal', 'Portugal', '2026-06-21 18:00:00+00', 'group_round_2', 4.80, 3.60, 1.70, 'Allegiant Stadium, Las Vegas'),
('Canada', 'Uruguay', '2026-06-21 21:00:00+00', 'group_round_2', 3.30, 3.25, 2.15, 'BC Place, Vancouver'),
('South Korea', 'Belgium', '2026-06-22 15:00:00+00', 'group_round_2', 5.50, 3.75, 1.58, 'Toyota Stadium, Dallas'),
('Cameroon', 'Croatia', '2026-06-22 18:00:00+00', 'group_round_2', 4.60, 3.50, 1.75, 'Hard Rock Stadium, Miami'),
('Morocco', 'Switzerland', '2026-06-22 21:00:00+00', 'group_round_2', 3.90, 3.30, 1.95, 'Gillette Stadium, Boston'),

-- Group Round 3
('United States', 'Mexico', '2026-06-25 18:00:00+00', 'group_round_3', 2.60, 3.20, 2.60, 'SoFi Stadium, Los Angeles'),
('Wales', 'Poland', '2026-06-25 18:00:00+00', 'group_round_3', 2.80, 3.15, 2.50, 'Estadio Azteca, Mexico City'),
('Argentina', 'France', '2026-06-26 15:00:00+00', 'group_round_3', 2.40, 3.25, 2.80, 'MetLife Stadium, New York'),
('Saudi Arabia', 'Australia', '2026-06-26 15:00:00+00', 'group_round_3', 3.80, 3.30, 1.95, 'AT&T Stadium, Dallas'),
('Spain', 'Germany', '2026-06-26 18:00:00+00', 'group_round_3', 2.20, 3.35, 3.10, 'Lincoln Financial Field, Philadelphia'),
('Costa Rica', 'Japan', '2026-06-26 18:00:00+00', 'group_round_3', 3.20, 3.30, 2.15, 'Lumen Field, Seattle'),
('Brazil', 'England', '2026-06-27 15:00:00+00', 'group_round_3', 2.30, 3.30, 2.95, 'Mercedes-Benz Stadium, Atlanta'),
('Serbia', 'Iran', '2026-06-27 15:00:00+00', 'group_round_3', 1.95, 3.40, 3.70, 'Arrowhead Stadium, Kansas City'),
('Portugal', 'Netherlands', '2026-06-27 18:00:00+00', 'group_round_3', 2.25, 3.35, 3.00, 'Allegiant Stadium, Las Vegas'),
('Ghana', 'Senegal', '2026-06-27 18:00:00+00', 'group_round_3', 2.65, 3.20, 2.60, 'BMO Field, Toronto'),
('Belgium', 'Uruguay', '2026-06-28 15:00:00+00', 'group_round_3', 2.15, 3.35, 3.15, 'BC Place, Vancouver'),
('Canada', 'South Korea', '2026-06-28 15:00:00+00', 'group_round_3', 1.80, 3.50, 4.00, 'Toyota Stadium, Dallas'),
('Croatia', 'Switzerland', '2026-06-28 18:00:00+00', 'group_round_3', 2.40, 3.25, 2.85, 'Hard Rock Stadium, Miami'),
('Morocco', 'Cameroon', '2026-06-28 18:00:00+00', 'group_round_3', 2.10, 3.35, 3.20, 'Gillette Stadium, Boston'),

-- Round of 32 (knockout begins)
('Group A Winner', 'Group B Runner-up', '2026-07-03 18:00:00+00', 'round_of_32', 1.90, 3.40, 3.80, 'SoFi Stadium, Los Angeles'),
('Group C Winner', 'Group D Runner-up', '2026-07-03 21:00:00+00', 'round_of_32', 1.85, 3.45, 3.90, 'MetLife Stadium, New York'),
('Group E Winner', 'Group F Runner-up', '2026-07-04 18:00:00+00', 'round_of_32', 1.80, 3.50, 4.10, 'Mercedes-Benz Stadium, Atlanta'),
('Group G Winner', 'Group H Runner-up', '2026-07-04 21:00:00+00', 'round_of_32', 1.75, 3.55, 4.25, 'Arrowhead Stadium, Kansas City'),

-- Round of 16
('R32 Winner 1', 'R32 Winner 2', '2026-07-07 18:00:00+00', 'round_of_16', 1.90, 3.35, 3.85, 'SoFi Stadium, Los Angeles'),
('R32 Winner 3', 'R32 Winner 4', '2026-07-07 21:00:00+00', 'round_of_16', 1.95, 3.30, 3.75, 'AT&T Stadium, Dallas'),
('R32 Winner 5', 'R32 Winner 6', '2026-07-08 18:00:00+00', 'round_of_16', 1.88, 3.38, 3.92, 'MetLife Stadium, New York'),
('R32 Winner 7', 'R32 Winner 8', '2026-07-08 21:00:00+00', 'round_of_16', 1.82, 3.42, 4.00, 'Mercedes-Benz Stadium, Atlanta'),

-- Quarter Finals
('R16 Winner 1', 'R16 Winner 2', '2026-07-11 18:00:00+00', 'quarter_finals', 1.95, 3.30, 3.75, 'SoFi Stadium, Los Angeles'),
('R16 Winner 3', 'R16 Winner 4', '2026-07-11 21:00:00+00', 'quarter_finals', 1.90, 3.35, 3.82, 'MetLife Stadium, New York'),

-- Semi Finals
('QF Winner 1', 'QF Winner 2', '2026-07-14 18:00:00+00', 'semi_finals', 1.95, 3.32, 3.78, 'AT&T Stadium, Dallas'),

-- Third Place
('SF Loser 1', 'SF Loser 2', '2026-07-17 18:00:00+00', 'third_place', 2.10, 3.25, 3.40, 'Mercedes-Benz Stadium, Atlanta'),

-- Final
('SF Winner 1', 'SF Winner 2', '2026-07-19 20:00:00+00', 'final', 1.98, 3.28, 3.70, 'MetLife Stadium, New York')
ON CONFLICT DO NOTHING;
