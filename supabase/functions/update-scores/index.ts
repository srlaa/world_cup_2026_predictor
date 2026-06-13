import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

interface ApiMatch {
  id: number;
  status: string;
  utcDate: string;
  matchday: number | null;
  stage: string;
  homeTeam: { name: string | null } | null;
  awayTeam: { name: string | null } | null;
  score?: { fullTime?: { home: number | null; away: number | null } };
}

interface ApiResponse {
  matches?: ApiMatch[];
}

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
type MatchRound =
  | 'group_round_1'
  | 'group_round_2'
  | 'group_round_3'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_finals'
  | 'semi_finals'
  | 'third_place'
  | 'final';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET');
  return Boolean(expected && req.headers.get('x-cron-secret') === expected);
}

function mapStatus(status: string): MatchStatus {
  switch (status) {
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

function mapRound(matchday: number | null, stage: string): MatchRound {
  const normalized = stage.toUpperCase();
  if (normalized.includes('GROUP')) {
    if (matchday === 2) return 'group_round_2';
    if (matchday === 3) return 'group_round_3';
    return 'group_round_1';
  }

  const rounds: Record<string, MatchRound> = {
    ROUND_OF_32: 'round_of_32',
    LAST_32: 'round_of_32',
    ROUND_OF_16: 'round_of_16',
    LAST_16: 'round_of_16',
    QUARTER_FINALS: 'quarter_finals',
    SEMI_FINALS: 'semi_finals',
    THIRD_PLACE: 'third_place',
    FINAL: 'final',
  };

  return rounds[normalized] ?? 'group_round_1';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const footballApiToken = Deno.env.get('FOOTBALL_API_TOKEN');
  if (!supabaseUrl || !serviceRoleKey || !footballApiToken) {
    return json({ error: 'Missing required server secrets' }, 500);
  }

  try {
    const response = await fetch(`${FOOTBALL_API_BASE}/competitions/WC/matches?season=2026`, {
      headers: { 'X-Auth-Token': footballApiToken },
    });
    if (!response.ok) {
      const details = await response.text();
      console.error('Football API score update failed', response.status, details);
      return json({ error: 'Football API request failed', status: response.status }, 502);
    }

    const payload = await response.json() as ApiResponse;
    const apiMatches = payload.matches ?? [];
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: existingError } = await supabase
      .from('matches')
      .select('api_match_id')
      .not('api_match_id', 'is', null);
    if (existingError) throw existingError;

    const existingIds = new Set((existing ?? []).map((match) => match.api_match_id));
    const newRows = apiMatches.flatMap((match) => {
      const apiMatchId = String(match.id);
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      if (existingIds.has(apiMatchId) || !homeTeam || !awayTeam) return [];

      return [{
        api_match_id: apiMatchId,
        home_team: homeTeam,
        away_team: awayTeam,
        kickoff_at: match.utcDate,
        round: mapRound(match.matchday, match.stage),
        status: mapStatus(match.status),
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        odds_home: 2,
        odds_draw: 3,
        odds_away: 2,
        odds_source: 'pending_dynamic_model',
        updated_at: new Date().toISOString(),
      }];
    });

    if (newRows.length > 0) {
      const { error: insertError } = await supabase.from('matches').insert(newRows);
      if (insertError) throw insertError;

      const { error: exactScoreError } = await supabase.rpc('refresh_exact_score_matches');
      if (exactScoreError) throw exactScoreError;
    }

    let updated = 0;
    for (const match of apiMatches) {
      const { error } = await supabase
        .from('matches')
        .update({
          kickoff_at: match.utcDate,
          status: mapStatus(match.status),
          home_score: match.score?.fullTime?.home ?? null,
          away_score: match.score?.fullTime?.away ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('api_match_id', String(match.id));
      if (error) throw error;
      updated += 1;
    }

    const { error: oddsError } = await supabase.rpc('refresh_dynamic_model_odds');
    if (oddsError) throw oddsError;

    const { error: scoringError } = await supabase.rpc('recalculate_all_scores');
    if (scoringError) throw scoringError;

    let oddsRefresh: 'not_needed' | 'requested' | 'failed' = 'not_needed';
    if (newRows.length > 0) {
      try {
        const oddsResponse = await fetch(`${supabaseUrl}/functions/v1/sync-odds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '',
          },
          body: '{}',
        });
        oddsRefresh = oddsResponse.ok ? 'requested' : 'failed';
        if (!oddsResponse.ok) {
          console.error('Immediate odds refresh failed', oddsResponse.status, await oddsResponse.text());
        }
      } catch (oddsError) {
        oddsRefresh = 'failed';
        console.error('Immediate odds refresh failed', oddsError);
      }
    }

    return json({
      success: true,
      processed: updated,
      newMatches: newRows.length,
      oddsRefresh,
    });
  } catch (error) {
    console.error('update-scores failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected update error' }, 500);
  }
});
