import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';

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

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
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
  status: MatchStatus;
  odds_source: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
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

const TEAM_RATINGS: Record<string, number> = {
  Argentina: 2000, Spain: 1980, France: 1960, England: 1930, Brazil: 1920,
  Portugal: 1900, Netherlands: 1880, Germany: 1870, Morocco: 1840,
  Colombia: 1830, Uruguay: 1820, Croatia: 1800, Belgium: 1790, Italy: 1780,
  Switzerland: 1770, Japan: 1760, Mexico: 1740, 'United States': 1730,
  Senegal: 1720, Iran: 1710, Denmark: 1700, Austria: 1690, Turkey: 1680,
  Ecuador: 1680, 'South Korea': 1660, Australia: 1640, Canada: 1630,
  Norway: 1620, Serbia: 1610, Sweden: 1600, 'Ivory Coast': 1600,
  Algeria: 1590, Egypt: 1580, Paraguay: 1570, Tunisia: 1560, Scotland: 1550,
  Panama: 1540, 'South Africa': 1530, 'Czechia': 1520, Qatar: 1500,
  'Saudi Arabia': 1490, Uzbekistan: 1480, 'Congo DR': 1470, Ghana: 1460,
  'Cape Verde Islands': 1450, Iraq: 1440, Jordan: 1430, 'New Zealand': 1410,
  'Bosnia-Herzegovina': 1400, Curaçao: 1360, Haiti: 1340,
};

function modelOdds(homeTeam: string, awayTeam: string): [number, number, number] {
  const homeRating = TEAM_RATINGS[homeTeam] ?? 1500;
  const awayRating = TEAM_RATINGS[awayTeam] ?? 1500;
  const difference = homeRating - awayRating;
  const drawProbability = Math.max(0.16, 0.28 * Math.exp(-Math.abs(difference) / 500));
  const homeShare = 1 / (1 + 10 ** (-difference / 400));
  const decisiveProbability = 1 - drawProbability;
  const probabilities = [
    decisiveProbability * homeShare,
    drawProbability,
    decisiveProbability * (1 - homeShare),
  ];
  const marketMargin = 1.06;
  return probabilities.map((probability) =>
    Number(Math.max(1.05, 1 / (probability * marketMargin)).toFixed(2))
  ) as [number, number, number];
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
  const { data: run } = await supabase.from('sync_runs').insert({ job_name: 'sync-matches' }).select('id').maybeSingle();

  try {
    const response = await fetch(`${FOOTBALL_API_BASE}/competitions/WC/matches?season=2026`, {
      headers: { 'X-Auth-Token': footballApiToken },
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Football API sync failed', response.status, details);
      throw new Error(`Football API request failed (${response.status})`);
    }

    const payload = await response.json() as ApiResponse;
    const apiMatches = payload.matches ?? [];
    if (apiMatches.length === 0) throw new Error('Football API returned no matches');

    const { data: existing, error: existingError } = await supabase
      .from('matches')
      .select('api_match_id, status, odds_source, odds_home, odds_draw, odds_away')
      .not('api_match_id', 'is', null);
    if (existingError) throw existingError;

    const existingByApiId = new Map(
      ((existing ?? []) as ExistingMatch[]).map((match) => [match.api_match_id, match]),
    );

    const rows = apiMatches.flatMap((match) => {
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      if (!homeTeam || !awayTeam) return [];

      const apiMatchId = String(match.id);
      const current = existingByApiId.get(apiMatchId);
      const hasFrozenOrRealOdds = current && (
        current.status !== 'scheduled' || current.odds_source.startsWith('the_odds_api_')
      );
      const [oddsHome, oddsDraw, oddsAway] = hasFrozenOrRealOdds
        ? [current.odds_home, current.odds_draw, current.odds_away]
        : modelOdds(homeTeam, awayTeam);

      const scores = scoreFields(match, mapStatus(match.status));

      return [{
        api_match_id: apiMatchId,
        home_team: homeTeam,
        away_team: awayTeam,
        kickoff_at: match.utcDate,
        round: mapRound(match.matchday, match.stage),
        status: mapStatus(match.status),
        ...scores,
        odds_home: oddsHome,
        odds_draw: oddsDraw,
        odds_away: oddsAway,
        odds_source: hasFrozenOrRealOdds ? current.odds_source : 'rating_model_v1',
        updated_at: new Date().toISOString(),
      }];
    });

    if (rows.length === 0) throw new Error('No matches with known teams were returned');

    const { error: upsertError } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'api_match_id' });
    if (upsertError) throw upsertError;

    const { error: exactScoreError } = await supabase.rpc('refresh_exact_score_matches');
    if (exactScoreError) throw exactScoreError;

    const { error: oddsError } = await supabase.rpc('refresh_dynamic_model_odds');
    if (oddsError) throw oddsError;

    const { error: scoringError } = await supabase.rpc('recalculate_all_scores');
    if (scoringError) throw scoringError;

    const summary = { received: apiMatches.length, synchronized: rows.length, skipped: apiMatches.length - rows.length };
    if (run?.id) await supabase.from('sync_runs').update({ success: true, completed_at: new Date().toISOString(), summary }).eq('id', run.id);

    return json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('sync-matches failed', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);
    if (run?.id) await supabase.from('sync_runs').update({ success: false, completed_at: new Date().toISOString(), error_message: message }).eq('id', run.id);
    return json({ error: message }, 500);
  }
});
