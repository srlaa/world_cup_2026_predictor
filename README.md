# World Cup 2026 Predictor

React and Supabase application for match predictions, private friend leagues,
automatic score updates, and protected prediction history.

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

Deploy all functions:

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

- `1/X/2` and exact score always refer to the result after 90 minutes.
- A correct outcome scores `odds x 10` points, rounded up.
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
- From the round of 32, an `X` pick opens a separate eventual-winner choice.
  Correctly predicting both the 90-minute draw and the winner after extra time
  or penalties adds 20 points. A `1` or `2` automatically selects that team as
  eventual winner; if the game is drawn after 90 minutes but that team still
  advances, the prediction receives 8 consolation points.
- Cancelled matches are void and do not block round-goal scoring.

Exact-score selections are frozen once all fixtures for a round exist. New API
syncs therefore cannot silently change which group or round-of-32 matches offer
the exact-score bonus.

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
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## Public frontend

Netlify builds `main` with `npm run build` and serves `dist`. Add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify environment
variables, then trigger **Deploy without cache**. Add the final Netlify URL to
the Supabase Auth redirect allow list and set it as the Site URL so sign-up and
password-reset links return to the application.

Users can create private leagues and share the generated invite link. Future
picks remain hidden until kickoff in both global and private standings.

## Tournament operations

- Check the admin-only **System health** screen daily. It shows the latest
  fixture, score, and odds synchronization result, including remaining odds
  credits.
- Before each knockout round, confirm all pairings are present and that odds
  have a recent `odds_updated_at` value.
- Export a database backup from Supabase before the tournament, after the group
  stage, and before the final. Keep the export outside the repository.
- For an urgent frontend bug, fix and push `main`; Netlify creates an immutable
  deploy that can also be rolled back from **Deploys**.
- For a scoring correction, update the database function through a migration
  and run `select public.recalculate_all_scores();`. It is idempotent.
- Rotate `CRON_SECRET` if it has appeared in terminal history, chat, screenshots,
  or logs, then update both Supabase secrets and Vault cron configuration.

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
