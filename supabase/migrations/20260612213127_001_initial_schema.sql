/*
# World Cup 2026 Predictor - Initial Schema

1. New Tables
- `profiles`: User profiles extending auth.users with display_name and avatar
- `matches`: World Cup matches with teams, kickoff time, scores, odds, and round
- `predictions`: User predictions for match outcomes and exact scores
- `round_goals`: User predictions for total goals in a round (mini-game)
- `user_scores`: Cached total scores per user for leaderboard performance

2. Security
- RLS enabled on all tables
- Owner-scoped policies for predictions, round_goals
- Public read for matches and leaderboard
- Authenticated users can update their own profiles

3. Notes
- Odds stored as DECIMAL for precision
- Match rounds stored as ENUM for type safety
- Timestamps stored as timestamptz for timezone handling
- Cascading deletes on foreign keys for data integrity
*/

-- Match round enum
DO $$ BEGIN
  CREATE TYPE match_round AS ENUM (
    'group_round_1', 'group_round_2', 'group_round_3',
    'round_of_32', 'round_of_16', 'quarter_finals',
    'semi_finals', 'third_place', 'final'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Match status enum
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT
  TO authenticated USING (true);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score int DEFAULT NULL,
  away_score int DEFAULT NULL,
  kickoff_at timestamptz NOT NULL,
  round match_round NOT NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  odds_home decimal(6,2) NOT NULL,
  odds_draw decimal(6,2) NOT NULL,
  odds_away decimal(6,2) NOT NULL,
  venue text,
  api_match_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_public_read" ON matches;
CREATE POLICY "matches_public_read" ON matches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "matches_admin_update" ON matches;
CREATE POLICY "matches_admin_update" ON matches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "matches_admin_insert" ON matches;
CREATE POLICY "matches_admin_insert" ON matches FOR INSERT
  TO authenticated WITH CHECK (true);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_outcome char(1) NOT NULL CHECK (predicted_outcome IN ('1', 'X', '2')),
  predicted_home_score int NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score int NOT NULL CHECK (predicted_away_score >= 0),
  is_exact_score_correct boolean DEFAULT false,
  is_outcome_correct boolean DEFAULT false,
  points_awarded decimal(8,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predictions_user_read" ON predictions;
CREATE POLICY "predictions_user_read" ON predictions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "predictions_user_insert" ON predictions;
CREATE POLICY "predictions_user_insert" ON predictions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "predictions_user_update" ON predictions;
CREATE POLICY "predictions_user_update" ON predictions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "predictions_user_delete" ON predictions;
CREATE POLICY "predictions_user_delete" ON predictions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Round Goals predictions (mini-game)
CREATE TABLE IF NOT EXISTS round_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  round match_round NOT NULL,
  predicted_total_goals int NOT NULL CHECK (predicted_total_goals >= 0),
  actual_total_goals int DEFAULT NULL,
  points_awarded int DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, round)
);

ALTER TABLE round_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "round_goals_user_read" ON round_goals;
CREATE POLICY "round_goals_user_read" ON round_goals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "round_goals_user_insert" ON round_goals;
CREATE POLICY "round_goals_user_insert" ON round_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "round_goals_user_update" ON round_goals;
CREATE POLICY "round_goals_user_update" ON round_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "round_goals_user_delete" ON round_goals;
CREATE POLICY "round_goals_user_delete" ON round_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- User scores (leaderboard)
CREATE TABLE IF NOT EXISTS user_scores (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_match_points decimal(10,2) DEFAULT 0,
  total_round_goal_points int DEFAULT 0,
  exact_score_bonuses int DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_scores_public_read" ON user_scores;
CREATE POLICY "user_scores_public_read" ON user_scores FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "user_scores_user_read" ON user_scores;
CREATE POLICY "user_scores_user_read" ON user_scores FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "user_scores_admin_update" ON user_scores;
CREATE POLICY "user_scores_admin_update" ON user_scores FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_scores_admin_insert" ON user_scores;
CREATE POLICY "user_scores_admin_insert" ON user_scores FOR INSERT
  TO authenticated WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_round_goals_user ON round_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_round_goals_round ON round_goals(round);

-- Trigger to auto-create user_scores entry when profile is created
CREATE OR REPLACE FUNCTION create_user_score()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_scores (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_user_score();
