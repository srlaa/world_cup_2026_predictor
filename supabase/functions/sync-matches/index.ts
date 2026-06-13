import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_API_TOKEN = 'c9567ef601374a77b2d9b00cc15acde5';

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string } | null;
  awayTeam: { id: number; name: string; shortName: string; tla: string } | null;
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

interface ApiMatchResponse {
  matches: ApiMatch[];
  competition: { id: number; name: string; code: string };
  resultSet: { count: number; first: string; last: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[sync-matches] Starting sync from Football-Data.org API...');

    // Fetch real World Cup 2026 matches from API
    const response = await fetch(`${FOOTBALL_API_BASE}/competitions/WC/matches?season=2026`, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_TOKEN,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[sync-matches] API error ${response.status}: ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `API returned ${response.status}`,
          details: errorText,
          hint: 'The World Cup 2026 data may not be available yet in the API. The API might only have historical data.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: ApiMatchResponse = await response.json();
    console.log(`[sync-matches] Fetched ${data.matches?.length || 0} matches from API`);
    console.log(`[sync-matches] Competition: ${data.competition?.name} (${data.competition?.code})`);

    if (!data.matches || data.matches.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No matches found in API response. World Cup 2026 data may not be available yet.',
          competition: data.competition,
          hint: 'Try fetching current World Cup data or wait until tournament data is published.',
          fallback: 'You can manually add matches via the database or admin interface.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear existing matches
    await supabase.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('round_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Map stage names to our round enum
    const stageToRound: Record<string, string> = {
      'GROUP_STAGE': 'group_round_1',
      'ROUND_OF_32': 'round_of_32',
      'ROUND_OF_16': 'round_of_16',
      'QUARTER_FINALS': 'quarter_finals',
      'SEMI_FINALS': 'semi_finals',
      'FINAL': 'final',
      'THIRD_PLACE': 'third_place',
    };

    // Determine group round based on matchday
    function getGroupRound(matchday: number, stage: string): string {
      const stageUpper = (stage || '').toUpperCase();
      if (stageUpper.includes('GROUP')) {
        if (matchday === 1) return 'group_round_1';
        if (matchday === 2) return 'group_round_2';
        if (matchday === 3) return 'group_round_3';
        return 'group_round_1';
      }
      return stageToRound[stageUpper] || 'group_round_1';
    }

    // Map status
    function mapStatus(apiStatus: string): 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' {
      switch (apiStatus) {
        case 'SCHEDULED':
        case 'TIMED':
          return 'scheduled';
        case 'IN_PLAY':
        case 'PAUSED':
        case 'LIVE':
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

    // Generate realistic odds based on team strength
    const strongTeams = ['Brazil', 'Argentina', 'France', 'England', 'Germany', 'Spain', 'Portugal', 'Netherlands'];
    const mediumTeams = ['Mexico', 'United States', 'Uruguay', 'Croatia', 'Belgium', 'Colombia', 'Switzerland', 'Denmark', 'Italy'];

    function generateOdds(homeTeam: string, awayTeam: string): { home: number; draw: number; away: number } {
      const homeStrength = strongTeams.includes(homeTeam) ? 3 : mediumTeams.includes(homeTeam) ? 2 : 1;
      const awayStrength = strongTeams.includes(awayTeam) ? 3 : mediumTeams.includes(awayTeam) ? 2 : 1;

      const diff = homeStrength - awayStrength;

      if (diff >= 2) {
        return { home: 1.25 + Math.random() * 0.3, draw: 5.0 + Math.random() * 1.5, away: 10.0 + Math.random() * 5 };
      } else if (diff === 1) {
        return { home: 1.6 + Math.random() * 0.4, draw: 3.7 + Math.random() * 0.6, away: 4.5 + Math.random() * 1.5 };
      } else if (diff === 0) {
        return { home: 2.2 + Math.random() * 0.4, draw: 3.3 + Math.random() * 0.2, away: 2.8 + Math.random() * 0.4 };
      } else if (diff === -1) {
        return { home: 4.0 + Math.random() * 1.5, draw: 3.7 + Math.random() * 0.6, away: 1.6 + Math.random() * 0.4 };
      } else {
        return { home: 9.0 + Math.random() * 5, draw: 5.0 + Math.random() * 1.5, away: 1.25 + Math.random() * 0.3 };
      }
    }

    // Filter and insert matches - only include matches with valid team names
    const matchesToInsert = [];
    const skippedMatches: ApiMatch[] = [];

    for (const match of data.matches) {
      const homeTeamName = match.homeTeam?.name;
      const awayTeamName = match.awayTeam?.name;

      // Skip matches without team names (e.g., TBD knockout matches)
      if (!homeTeamName || !awayTeamName) {
        skippedMatches.push(match);
        console.log(`[sync-matches] Skipping match ${match.id}: teams not determined yet (stage: ${match.stage})`);
        continue;
      }

      const odds = generateOdds(homeTeamName, awayTeamName);
      const round = getGroupRound(match.matchday, match.stage);

      matchesToInsert.push({
        home_team: homeTeamName,
        away_team: awayTeamName,
        kickoff_at: match.utcDate,
        round: round,
        status: mapStatus(match.status),
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        odds_home: Math.round(odds.home * 100) / 100,
        odds_draw: Math.round(odds.draw * 100) / 100,
        odds_away: Math.round(odds.away * 100) / 100,
        venue: null,
        api_match_id: match.id.toString()
      });
    }

    console.log(`[sync-matches] Inserting ${matchesToInsert.length} matches, skipping ${skippedMatches.length} TBD matches`);

    if (matchesToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No valid matches found. All matches have TBD teams.',
          totalApiMatches: data.matches.length,
          skipped: skippedMatches.length,
          hint: 'The World Cup 2026 draw may not be complete yet. Teams shown as TBD in the API.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insertError } = await supabase
      .from('matches')
      .insert(matchesToInsert);

    if (insertError) {
      console.error('[sync-matches] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert matches', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get stats
    const { data: stats } = await supabase
      .from('matches')
      .select('round, status')
      .order('kickoff_at', { ascending: true });

    const groupedStats = {
      total: stats?.length || 0,
      scheduled: stats?.filter(m => m.status === 'scheduled').length || 0,
      live: stats?.filter(m => m.status === 'live').length || 0,
      finished: stats?.filter(m => m.status === 'finished').length || 0,
    };

    console.log(`[sync-matches] Successfully inserted ${groupedStats.total} matches`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${groupedStats.total} matches from Football-Data.org API`,
        competition: data.competition,
        stats: groupedStats,
        skipped: skippedMatches.length,
        sampleMatches: matchesToInsert.slice(0, 10).map(m => ({
          home: m.home_team,
          away: m.away_team,
          kickoff: m.kickoff_at,
          round: m.round,
          status: m.status
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-matches] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        hint: 'Check if the API is accessible and the token is valid'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
