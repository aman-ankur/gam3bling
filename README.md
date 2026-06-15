# Gam3bling

Mobile-first FIFA World Cup 2026 prediction rooms for small friend groups.

Production: https://game-bling.vercel.app

Gam3bling is built for small tournament group chats: create a room, invite friends, lock predictions before kickoff, and settle the table when results land. It is not a betting product. There are no real-money flows, no fantasy-team admin, and no account setup.

## What The App Does

- Creates private World Cup prediction rooms with short invite links and room codes.
- Lets friends join with a display name instead of email/password.
- Shows the current room, live match, next open predictions, and recent results from a mobile-first room hub.
- Supports predictions for final score, match result, half-time score, first team to score, and last team to score.
- Locks predictions at kickoff.
- Shows a compact saved-prediction receipt, then reveals friends' predictions after you have saved yours.
- Scores settled matches and shows room/global leaderboards.
- Keeps result history clickable so players can jump back into the match conclusion view.
- Works from seeded fixtures even when external football data is limited.

## Product Shape

The main loop is intentionally small:

1. Create a room.
2. Share the link and room code.
3. Friends join from their phone.
4. Everyone submits predictions before kickoff.
5. The room hub highlights live/open matches first.
6. After the match, the result page shows who predicted what and who scored.

The UI favors dense, readable phone screens over dashboard sprawl: dark match cards, quieter gold accents, compact accordions, and bottom navigation that keeps the main routes one tap away.

## Current Football Data Strategy

Fixtures are stored locally in Supabase so the app remains usable without live API access. Provider sync is an enhancement layer:

- ESPN public soccer endpoints are the current no-key provider for score, status, lineup, and stats refreshes where available.
- API-Football remains behind the provider abstraction, but the current account is suspended, so direct API-Football sync is not available until access is restored.
- Manual score refresh buttons surface provider access failures clearly instead of hiding them.
- First/last scorer scoring can stay pending when the provider does not expose enough mapped event data.

## Tech Stack

- Next.js 15 App Router
- TypeScript
- React server actions
- Supabase Postgres
- Vercel
- Vitest
- Playwright
- ESLint

Core app code lives in:

- `app/` for routes, pages, route handlers, and server-action entry points.
- `components/` for reusable UI.
- `features/` for room, match, prediction, scoring, sync, and provider logic.
- `db/` for migrations and seed data.
- `testing/e2e/` for Playwright coverage.

## Local Development

Run the app only on `http://127.0.0.1:3003`:

```bash
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

If you run e2e after `npm run build`, clear `.next` before `npm run test:e2e` so Next does not mix production and dev cache state.

## Environment

Required for a real Supabase-backed run:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
SYNC_JOB_SECRET=
ESPN_SOCCER_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

`ESPN_SOCCER_BASE_URL` is optional unless the endpoint needs to be overridden. Keep API-Football configured only when access is restored or when testing fallback behavior.

## Deployment

Production deploys through Vercel:

```bash
npx --registry https://registry.npmjs.org vercel deploy --prod --force
```

Do not use `vercel deploy --prebuilt --prod` for production. The app relies on Vercel runtime environment variables being attached correctly to server actions.

## Docs

- Product reference: `docs/PRD.md`
- Technical reference: `docs/TECHNICAL_SPEC.md`
- Deployment checklist: `docs/DEPLOYMENT.md`
- Database notes: `db/README.md`
- Historical build plans and handoffs: `docs/`

## Status

The MVP is live and usable for small groups. The main open product risk is live football data quality and provider access, not the core prediction-room flow.
