import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_API_RETRY_DELAYS_MS = [750, 2_000];

interface ApiMatch {
  id: number;
  status: string;
  utcDate: string;
  matchday: number | null;
  stage: string;
  homeTeam: { name: string | null } | null;
  awayTeam: { name: string | null } | null;
  score?: {
    winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | null;
    fullTime?: ScorePair;
    regularTime?: ScorePair;
  };
}

interface ScorePair {
  home?: number | null;
  away?: number | null;
  homeTeam?: number | null;
  awayTeam?: number | null;
}

interface ApiResponse {
  matches?: ApiMatch[];
}

interface ExistingMatch {
  api_match_id: string;
  kickoff_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: string | null;
  winner_team: string | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchFootballMatches(footballApiToken: string): Promise<Response> {
  let lastError: unknown;
  const url = `${FOOTBALL_API_BASE}/competitions/WC/matches?season=2026`;

  for (let attempt = 0; attempt <= FOOTBALL_API_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(url, {
        headers: { 'X-Auth-Token': footballApiToken },
      });
    } catch (error) {
      lastError = error;
      const delay = FOOTBALL_API_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      console.warn(`Football API connection failed; retrying in ${delay}ms`, error);
      await sleep(delay);
    }
  }

  throw new Error(`Football API connection failed after ${FOOTBALL_API_RETRY_DELAYS_MS.length + 1} attempts: ${errorMessage(lastError)}`);
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

function scoreValue(pair: ScorePair | undefined, side: 'home' | 'away'): number | null {
  if (!pair) return null;
  return pair[side] ?? pair[side === 'home' ? 'homeTeam' : 'awayTeam'] ?? null;
}

function scoreFields(match: ApiMatch, status: MatchStatus) {
  const finalHome = scoreValue(match.score?.fullTime, 'home');
  const finalAway = scoreValue(match.score?.fullTime, 'away');
  const regularHome = scoreValue(match.score?.regularTime, 'home');
  const regularAway = scoreValue(match.score?.regularTime, 'away');
  const useFullTimeAsRegular = status !== 'finished' || !match.score?.duration || match.score.duration === 'REGULAR';
  return {
    home_score: regularHome ?? (useFullTimeAsRegular ? finalHome : null),
    away_score: regularAway ?? (useFullTimeAsRegular ? finalAway : null),
    final_home_score: finalHome,
    final_away_score: finalAway,
    score_duration: match.score?.duration ?? null,
    winner_team: match.score?.winner === 'HOME_TEAM'
      ? match.homeTeam?.name ?? null
      : match.score?.winner === 'AWAY_TEAM'
        ? match.awayTeam?.name ?? null
        : null,
  };
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: run } = await supabase.from('sync_runs').insert({ job_name: 'update-scores' }).select('id').maybeSingle();

  try {
    const response = await fetchFootballMatches(footballApiToken);
    if (!response.ok) {
      const details = await response.text();
      console.error('Football API score update failed', response.status, details);
      throw new Error(`Football API request failed (${response.status})`);
    }

    const payload = await response.json() as ApiResponse;
    const apiMatches = payload.matches ?? [];
    const { data: existing, error: existingError } = await supabase
      .from('matches')
      .select('api_match_id, kickoff_at, status, home_score, away_score, final_home_score, final_away_score, score_duration, winner_team')
      .not('api_match_id', 'is', null);
    if (existingError) throw existingError;

    const existingByApiId = new Map(
      ((existing ?? []) as ExistingMatch[]).map((match) => [match.api_match_id, match]),
    );
    const newRows = apiMatches.flatMap((match) => {
      const apiMatchId = String(match.id);
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      if (existingByApiId.has(apiMatchId) || !homeTeam || !awayTeam) return [];
      const scores = scoreFields(match, mapStatus(match.status));

      return [{
        api_match_id: apiMatchId,
        home_team: homeTeam,
        away_team: awayTeam,
        kickoff_at: match.utcDate,
        round: mapRound(match.matchday, match.stage),
        status: mapStatus(match.status),
        ...scores,
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
      const current = existingByApiId.get(String(match.id));
      if (!current) continue;

      const nextStatus = mapStatus(match.status);
      const scores = scoreFields(match, nextStatus);
      const hasChanged = new Date(current.kickoff_at).getTime() !== new Date(match.utcDate).getTime()
        || current.status !== nextStatus
        || current.home_score !== scores.home_score
        || current.away_score !== scores.away_score
        || current.final_home_score !== scores.final_home_score
        || current.final_away_score !== scores.final_away_score
        || current.score_duration !== scores.score_duration
        || current.winner_team !== scores.winner_team;
      if (!hasChanged) continue;

      const { error } = await supabase
        .from('matches')
        .update({
          kickoff_at: match.utcDate,
          status: nextStatus,
          ...scores,
          updated_at: new Date().toISOString(),
        })
        .eq('api_match_id', String(match.id));
      if (error) throw error;
      updated += 1;
    }

    if (newRows.length > 0 || updated > 0) {
      const { error: oddsError } = await supabase.rpc('refresh_dynamic_model_odds');
      if (oddsError) throw oddsError;

      const { error: scoringError } = await supabase.rpc('recalculate_all_scores');
      if (scoringError) throw scoringError;
    }

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

    const summary = { processed: updated, newMatches: newRows.length, oddsRefresh };
    if (run?.id) await supabase.from('sync_runs').update({ success: true, completed_at: new Date().toISOString(), summary }).eq('id', run.id);
    return json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('update-scores failed', error);
    const message = error instanceof Error ? error.message : 'Unexpected update error';
    if (run?.id) await supabase.from('sync_runs').update({ success: false, completed_at: new Date().toISOString(), error_message: message }).eq('id', run.id);
    return json({ error: message }, 500);
  }
});
