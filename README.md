# World Cup 2026 Predictor

React and Supabase application for match predictions, round-goal predictions,
automatic score updates, and a global leaderboard.

## Stack

- React 18, TypeScript, Vite, Tailwind CSS
- Supabase Auth, Postgres, Row Level Security, Edge Functions, Cron
- Football-Data.org as the match and score provider

## Local frontend

Requirements: Node.js 20+ and an existing Supabase project.

```bash
npm ci
cp .env.example .env
```

Fill `.env` with the project URL and publishable/anon key from the Supabase
dashboard. Never put a service-role key in this file.

```bash
npm run dev
```

## Supabase setup

Install the Supabase CLI, log in, and link the repository to a project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Rotate the Football-Data.org token that was previously committed to this
repository. Then configure server-only secrets:

```bash
npx supabase secrets set FOOTBALL_API_TOKEN=YOUR_NEW_TOKEN
npx supabase secrets set CRON_SECRET=YOUR_LONG_RANDOM_SECRET
npx supabase secrets set ODDS_API_KEY=YOUR_THE_ODDS_API_KEY
```

Deploy both functions:

```bash
npx supabase functions deploy sync-matches
npx supabase functions deploy update-scores
npx supabase functions deploy sync-odds
```

The functions reject requests without the matching `x-cron-secret` header.
They use the platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Automatic updates

Open `supabase/cron.sql.example`, replace the three placeholders, and execute it
in the Supabase SQL editor. It schedules:

- fixture synchronization once per day
- score synchronization and newly confirmed knockout pairings every five minutes
- bookmaker odds synchronization every six hours

Run the fixture sync once immediately after deployment:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-matches" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-cron-secret: YOUR_LONG_RANDOM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

The sync uses `api_match_id` as a stable key. Existing predictions are never
deleted. Score calculation is idempotent, so repeated jobs do not duplicate
points.

When a knockout pairing becomes available from Football-Data.org, the
five-minute score job inserts it immediately and requests bookmaker odds. In
normal operation the match is visible in the app within about six minutes:
five minutes for the backend job and up to one minute for the open browser to
refresh.

The Football-Data.org free plan allows 10 calls per minute but documents scores
and schedules as delayed. The five-minute job therefore updates the app as soon
as the free provider exposes a change, but it cannot guarantee live-score timing.

## Scoring rules

- A correct outcome scores `odds x 10` points.
- An exact score adds 50 points and is never multiplied.
- Exact-score fields appear on a stable pseudo-random selection of 6 matches in
  each group round and 4 matches in the round of 32. They appear on every match
  from the round of 16 onward.
- Boost badges multiply only correct-outcome points by two. Each user receives
  6 per group round, 4 in the round of 32, 2 in the round of 16, and 1 in the
  quarter-finals.
- Quarter-final outcome points have a `1.5x` round multiplier.
- Semi-final and final outcome points have a `2x` round multiplier.
- Boost badges are unavailable after the quarter-finals.

## Match odds

The Odds API free plan is the primary source for World Cup pre-match `1/X/2`
prices. `sync-odds` requests one EU bookmaker region and one `h2h` market, then
stores the median decimal price across available bookmakers. A six-hour cron
schedule uses about 120 of the free 500 monthly credits.

A dynamic Elo model remains the fallback when bookmakers have not published a
new group or knockout pairing. It starts from maintained pre-tournament team
strength and incorporates completed tournament results, goal difference, and
higher knockout-stage weighting. Market odds always take priority over Elo.

Both sources update only scheduled future matches. The last price is frozen at
kickoff so prediction points cannot change after the match starts. Repeated Elo
refreshes are deterministic and cannot count a result twice.

## Security model

- Users can read matches and leaderboard totals.
- Users can read and edit only their own predictions.
- Other players' predictions are exposed through a protected database function
  only after the relevant match or round has started, preventing copied picks.
- Database triggers reject predictions after kickoff.
- Calculated points, match results, and leaderboard totals are server-owned.
- User profiles and score rows are created by an `auth.users` trigger.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## Public frontend

The GitHub Pages workflow deploys every push to `main`. Select **GitHub
Actions** under repository **Settings > Pages**. The public URL will be:

```text
https://srlaa.github.io/world_cup_2026_predictor/
```

Also add that URL to the Supabase Auth redirect allow list and set it as the
Site URL. Supabase's default email sender has a low rate limit; for a small
private group, either disable email confirmation or configure a custom SMTP
provider before inviting everyone at once.

## Free-plan budget

- Supabase receives roughly 12,000 scheduled Edge Function invocations during
  a 40-day tournament, far below the 500,000 monthly free quota. Match changes
  use Realtime, while a ten-minute browser fallback pauses in background tabs
  and retrieves only the selected round's predictions.
- The Odds API runs four times daily, about 120 credits per 30 days, below the
  500-credit free allowance. New knockout pairings add only a handful of runs.
- Football-Data.org is called once every five minutes, below its 10 calls/minute
  free-plan rate limit.
- Netlify's current free plan has 300 monthly credits. Each production deploy
  costs 15 credits, so avoid more than 20 production deploys per billing month.
  The static site is under 0.5 MB, making friend-group traffic inexpensive.
