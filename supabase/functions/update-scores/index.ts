import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_API_TOKEN = 'c9567ef601374a77b2d9b00cc15acde5';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch current World Cup matches from API
    const response = await fetch(`${FOOTBALL_API_BASE}/competitions/WC/matches?season=2026`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
    });

    const apiData = await response.json();
    const apiMatches = apiData.matches || [];

    // Build lookup map
    const apiMatchMap = new Map();
    for (const match of apiMatches) {
      if (match.homeTeam?.name && match.awayTeam?.name) {
        apiMatchMap.set(match.id.toString(), match);
      }
    }

    // Get all matches from database
    const { data: dbMatches } = await supabase
      .from('matches')
      .select('id, api_match_id, home_team, away_team, status, home_score, away_score, odds_home, odds_draw, odds_away')
      .in('status', ['scheduled', 'live']);

    const updates: any[] = [];

    for (const dbMatch of (dbMatches || [])) {
      const apiMatch = apiMatchMap.get(dbMatch.api_match_id);
      if (!apiMatch) continue;

      const newStatus = mapStatus(apiMatch.status);
      const newHomeScore = apiMatch.score?.fullTime?.home;
      const newAwayScore = apiMatch.score?.fullTime?.away;

      if (newStatus !== dbMatch.status || newHomeScore !== dbMatch.home_score || newAwayScore !== dbMatch.awayScore) {
        updates.push({ dbMatch, newStatus, newHomeScore, newAwayScore });

        await supabase
          .from('matches')
          .update({
            status: newStatus,
            home_score: newHomeScore,
            away_score: newAwayScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', dbMatch.id);

        // Calculate points if match just finished
        if (newStatus === 'finished' && dbMatch.status !== 'finished' && newHomeScore !== null && newAwayScore !== null) {
          await calculateMatchPoints(supabase, dbMatch.id, newHomeScore, newAwayScore, dbMatch.odds_home, dbMatch.odds_draw, dbMatch.odds_away);
        }
      }
    }

    await processRoundGoals(supabase);

    const { data: stats } = await supabase
      .from('matches')
      .select('status')
      .order('kickoff_at', { ascending: true });

    return new Response(
      JSON.stringify({
        success: true,
        matchesUpdated: updates.length,
        stats: {
          total: stats?.length || 0,
          scheduled: stats?.filter(m => m.status === 'scheduled').length || 0,
          live: stats?.filter(m => m.status === 'live').length || 0,
          finished: stats?.filter(m => m.status === 'finished').length || 0,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapStatus(status: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
      return 'finished';
    case 'POSTPONED':
      return 'postponed';
    case 'CANCELLED':
    case 'SUSPENDED':
    case 'AWARDED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}

async function calculateMatchPoints(
  supabase: any,
  matchId: string,
  homeScore: number,
  awayScore: number,
  oddsHome: number,
  oddsDraw: number,
  oddsAway: number
) {
  const actualOutcome = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
  const oddsMap: Record<string, number> = { '1': oddsHome, 'X': oddsDraw, '2': oddsAway };

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_id', matchId);

  for (const pred of (predictions || [])) {
    const isOutcomeCorrect = pred.predicted_outcome === actualOutcome;
    const isExactScoreCorrect = pred.predicted_home_score === homeScore && pred.predicted_away_score === awayScore;
    const points = (isOutcomeCorrect ? oddsMap[pred.predicted_outcome] * 10 : 0) + (isExactScoreCorrect ? 50 : 0);

    await supabase.from('predictions').update({
      is_outcome_correct: isOutcomeCorrect,
      is_exact_score_correct: isExactScoreCorrect,
      points_awarded: points,
    }).eq('id', pred.id);

    const { data: score } = await supabase.from('user_scores').select('*').eq('user_id', pred.user_id).maybeSingle();
    if (score) {
      await supabase.from('user_scores').update({
        total_match_points: Number(score.total_match_points || 0) + points,
        exact_score_bonuses: isExactScoreCorrect ? score.exact_score_bonuses + 1 : score.exact_score_bonuses,
        last_updated: new Date().toISOString()
      }).eq('user_id', pred.user_id);
    }
  }
}

async function processRoundGoals(supabase: any) {
  const rounds = ['group_round_1', 'group_round_2', 'group_round_3', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final'];

  for (const round of rounds) {
    const { data: roundMatches } = await supabase.from('matches').select('status, home_score, away_score').eq('round', round);
    if (!roundMatches?.length || !roundMatches.every(m => m.status === 'finished')) continue;

    const totalGoals = roundMatches.reduce((sum, m) => sum + (m.home_score || 0) + (m.away_score || 0), 0);
    const { data: predictions } = await supabase.from('round_goals').select('*').eq('round', round).is('actual_total_goals', null);

    for (const pred of (predictions || [])) {
      const diff = Math.abs(pred.predicted_total_goals - totalGoals);
      const points = Math.max(0, 100 - diff * 2);

      await supabase.from('round_goals').update({
        actual_total_goals: totalGoals,
        points_awarded: points,
      }).eq('id', pred.id);

      const { data: score } = await supabase.from('user_scores').select('*').eq('user_id', pred.user_id).maybeSingle();
      if (score) {
        await supabase.from('user_scores').update({
          total_round_goal_points: Number(score.total_round_goal_points || 0) + points,
        }).eq('user_id', pred.user_id);
      }
    }
  }
}
