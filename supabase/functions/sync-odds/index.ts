import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'soccer_fifa_world_cup';

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{ key: string; outcomes: OddsOutcome[] }>;
  }>;
}

interface DbMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
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

const TEAM_ALIASES: Record<string, string> = {
  usa: 'unitedstates',
  us: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  iriran: 'iran',
  coteivoire: 'ivorycoast',
  democraticrepublicofthecongo: 'congodr',
  drcongo: 'congodr',
  capeverde: 'capeverdeislands',
  turkiye: 'turkey',
  czechrepublic: 'czechia',
};

function normalizeTeam(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return TEAM_ALIASES[normalized] ?? normalized;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return Number(value.toFixed(2));
}

function consensusOdds(event: OddsEvent): [number, number, number] | null {
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];

  for (const bookmaker of event.bookmakers) {
    const market = bookmaker.markets.find((candidate) => candidate.key === 'h2h');
    if (!market) continue;

    for (const outcome of market.outcomes) {
      const normalized = normalizeTeam(outcome.name);
      if (normalized === normalizeTeam(event.home_team)) homePrices.push(outcome.price);
      else if (normalized === normalizeTeam(event.away_team)) awayPrices.push(outcome.price);
      else if (outcome.name.toLowerCase() === 'draw') drawPrices.push(outcome.price);
    }
  }

  const home = median(homePrices);
  const draw = median(drawPrices);
  const away = median(awayPrices);
  return home && draw && away ? [home, draw, away] : null;
}

function findDbMatch(event: OddsEvent, matches: DbMatch[]): DbMatch | null {
  const eventHome = normalizeTeam(event.home_team);
  const eventAway = normalizeTeam(event.away_team);
  const eventTime = new Date(event.commence_time).getTime();

  return matches
    .filter((match) => {
      const home = normalizeTeam(match.home_team);
      const away = normalizeTeam(match.away_team);
      return (home === eventHome && away === eventAway) || (home === eventAway && away === eventHome);
    })
    .map((match) => ({ match, distance: Math.abs(new Date(match.kickoff_at).getTime() - eventTime) }))
    .filter(({ distance }) => distance <= 12 * 60 * 60 * 1000)
    .sort((a, b) => a.distance - b.distance)[0]?.match ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const oddsApiKey = Deno.env.get('ODDS_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !oddsApiKey) {
    return json({ error: 'Missing ODDS_API_KEY or Supabase server secrets' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: run } = await supabase.from('sync_runs').insert({ job_name: 'sync-odds' }).select('id').maybeSingle();

  try {
    const now = new Date().toISOString();
    const { data, error: matchesError } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff_at')
      .eq('status', 'scheduled')
      .gt('kickoff_at', now)
      .is('odds_locked_at', null);
    if (matchesError) throw matchesError;

    const matches = (data ?? []) as DbMatch[];
    if (matches.length === 0) {
      const summary = { skipped: true, reason: 'all_known_matches_locked', requestsUsed: 0 };
      if (run?.id) await supabase.from('sync_runs').update({ success: true, completed_at: new Date().toISOString(), summary }).eq('id', run.id);
      return json({ success: true, ...summary });
    }

    const url = new URL(`${ODDS_API_BASE}/sports/${SPORT_KEY}/odds`);
    url.searchParams.set('apiKey', oddsApiKey);
    url.searchParams.set('regions', 'eu');
    url.searchParams.set('markets', 'h2h');
    url.searchParams.set('oddsFormat', 'decimal');
    url.searchParams.set('dateFormat', 'iso');

    const response = await fetch(url);
    if (!response.ok) {
      const details = await response.text();
      console.error('Odds API request failed', response.status, details);
      throw new Error(`Odds provider request failed (${response.status})`);
    }

    const events = await response.json() as OddsEvent[];
    let updated = 0;
    let unmatched = 0;

    for (const event of events) {
      const match = findDbMatch(event, matches);
      const odds = consensusOdds(event);
      if (!match || !odds) {
        unmatched += 1;
        continue;
      }

      const orientationMatches = normalizeTeam(match.home_team) === normalizeTeam(event.home_team);
      const [providerHome, draw, providerAway] = odds;
      const lockedAt = new Date().toISOString();
      const home = orientationMatches ? providerHome : providerAway;
      const away = orientationMatches ? providerAway : providerHome;
      const source = `the_odds_api_median_${event.bookmakers.length}`;
      const { error } = await supabase
        .from('matches')
        .update({
          odds_home: home,
          odds_draw: draw,
          odds_away: away,
          odds_source: source,
          odds_updated_at: lockedAt,
          locked_odds_home: home,
          locked_odds_draw: draw,
          locked_odds_away: away,
          locked_odds_source: source,
          odds_locked_at: lockedAt,
          updated_at: lockedAt,
        })
        .eq('id', match.id)
        .eq('status', 'scheduled')
        .gt('kickoff_at', now)
        .is('odds_locked_at', null);
      if (error) throw error;
      updated += 1;
    }

    const summary = {
      eventsReceived: events.length,
      matchesUpdated: updated,
      unmatched,
      requestsUsed: response.headers.get('x-requests-used'),
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsLast: response.headers.get('x-requests-last'),
    };
    if (run?.id) await supabase.from('sync_runs').update({ success: true, completed_at: new Date().toISOString(), summary }).eq('id', run.id);
    return json({ success: true, ...summary });
  } catch (error) {
    console.error('sync-odds failed', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);
    if (run?.id) await supabase.from('sync_runs').update({ success: false, completed_at: new Date().toISOString(), error_message: message }).eq('id', run.id);
    return json({ error: message }, 500);
  }
});
