import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  round: MatchRound;
  status: MatchStatus;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  venue: string | null;
  api_match_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Prediction = {
  id: string;
  user_id: string;
  match_id: string;
  predicted_outcome: '1' | 'X' | '2';
  predicted_home_score: number;
  predicted_away_score: number;
  is_exact_score_correct: boolean;
  is_outcome_correct: boolean;
  points_awarded: number;
  created_at: string;
  updated_at: string;
};

export type RoundGoal = {
  id: string;
  user_id: string;
  round: MatchRound;
  predicted_total_goals: number;
  actual_total_goals: number | null;
  points_awarded: number | null;
  created_at: string;
  updated_at: string;
};

export type UserScore = {
  user_id: string;
  total_match_points: number;
  total_round_goal_points: number;
  exact_score_bonuses: number;
  last_updated: string;
};

export type MatchRound =
  | 'group_round_1'
  | 'group_round_2'
  | 'group_round_3'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export const ROUND_LABELS: Record<MatchRound, string> = {
  group_round_1: 'Round 1',
  group_round_2: 'Round 2',
  group_round_3: 'Round 3',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_finals: 'Quarter Finals',
  semi_finals: 'Semi Finals',
  third_place: 'Third Place',
  final: 'Final',
};
