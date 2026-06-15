# Session Handoff: 2026-06-15

This note captures the product, UX, deployment, and verification state after the
post-launch polish pass.

## Current Live State

- Production URL: `https://game-bling.vercel.app`
- GitHub repo: `aman-ankur/gam3bling`
- Branch: `main`
- Commit style: small focused commits on `main`.
- Latest functional pushed/deployed commit before this docs refresh: `1e304a7`
- Vercel project: `aman-ankurs-projects/game-bling`
- Production deploy path: normal Vercel cloud build, not prebuilt.
- Latest inspected production deployment: `dpl_5ukbrgCvpUFWZC94nUQ4wArLe3RB`
  - Deployment URL: `https://game-bling-n6qnsnd4x-aman-ankurs-projects.vercel.app`
  - Aliased to `https://game-bling.vercel.app`

Use:

```bash
npx --registry https://registry.npmjs.org vercel deploy --prod --force
```

Do not use `vercel deploy --prebuilt --prod` for production. Earlier prebuilt
deploys did not reliably attach runtime environment variables to Next server
actions.

## Product State

- Users create rooms at `/new`.
- Room creators share the generated room link and invite code.
- Returning room hubs show the invite link and room code below the Results ledger.
- New rooms persist the visible room code in `rooms.invite_code` once the Supabase migration is applied.
- Legacy rooms that predate `rooms.invite_code` cannot recover the code from `invite_code_hash`; users must enter the original code once in the room hub recovery form or join with it again to backfill the visible code.
- Friends can join from:
  - `/r/[slug]?invite=CODE`
  - Home page room-code form
- Users join with room code + display name. There is no visible PIN.
- The legacy `players.pin_hash` column is still populated with a random internal
  server-generated secret so no Supabase SQL change is required.
- The current browser session is stored in a signed HTTP-only cookie.
- Home shows `Your rooms` for the current browser session before the generic
  join/create sections.
- `/r/[slug]` is a room hub for returning/session users:
  - Live/current fixtures first, then open upcoming fixtures.
  - Manual `Refresh scores` button for free-tier Vercel environments without Cron.
  - Room score/leaderboard preview next.
  - History/results preview after that.
  - Invite link + room code panel below the Results ledger.
  - New visitors still see the invite-code join form.
- `/r/[slug]/matches` shows the next four open fixtures and locks later
  fixtures.
- `/r/[slug]/matches/[matchId]` supports five prediction markets:
  - Final score
  - Match result
  - Half-time score
  - First team to score
  - Last team to score
- Final score drives match-result selection automatically.
- Impossible scorer choices are disabled.
- Half-time scores are clamped to final-score constraints.
- After saving a prediction:
  - The page shows a compact one-line prediction receipt first.
  - Friends' predictions appear directly below.
  - The full editable prediction form is inside an expandable `Edit prediction`
    panel until kickoff.
- Bottom navigation is fixed/sticky, route-aware, and uses `Matches` instead of
  `Picks`.
- Visible copy uses `predictions`, not `slips` or `picks`.
- Live/current match cards show synced scores and a ticking match clock when
  score data is available.
- Match detail pages show a compact live scoreboard above the prediction tabs.
- Lineups render on a football pitch with shirt numbers, short player names,
  positions, and formation-aware rows.
- Buttons that trigger server actions show immediate pending states:
  - `Creating room...`
  - `Joining room...`
  - `Entering room...`
  - `Saving predictions...`

## Important Implementation Notes

- Shared pending button: `components/submit-button.tsx`
  - Uses React `useFormStatus`.
  - Sets `aria-busy`.
  - Disables while pending.
- Saved receipt UI: `components/prediction-receipt.tsx`
- Editable prediction form: `components/prediction-form.tsx`
  - Accepts `initialPrediction` so saved values reopen correctly.
- Friends' predictions board: `components/room-picks-board.tsx`
  - Internal class/component names still include `pick`, but visible copy says
    prediction.
- Current-room shortcut helper:
  - `features/rooms/data.ts`
  - `getCurrentPlayerRoomShortcuts()`
- Room hub:
  - `app/r/[slug]/page.tsx`
- Room invite panel:
  - `components/room-invite-card.tsx`
  - Copies link + code together, or code only.
  - Shows legacy code recovery when a room has no stored visible code.
- Room actions:
  - `features/rooms/actions.ts`
  - `createRoom`, `joinRoom`, `joinRoomByCode`, and `rememberRoomInviteCode`.
  - Creation/join code is backward-compatible while `rooms.invite_code` is pending in production.
- Saved match flow:
  - `app/r/[slug]/matches/[matchId]/page.tsx`
- Shared live clock:
  - `components/live-match-clock.tsx`
  - `features/matches/live-clock.ts`
- Match details provider/cache flow:
  - `features/sync/default-provider.ts`
  - `features/sync/espn-provider.ts`
  - `features/match-details/cache.ts`
  - `features/match-details/data.ts`
- Approved HTML planning artifact:
  - `mockuup/post-save-room-hub-flow.html`

## Verification State

Before the latest production deploy, these passed locally:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Latest verified results after ESPN lineup-cache fix (`1e304a7`):

- Unit tests: 126/126 passed.
- Browser tests: 22/22 passed.
- Production Vercel cloud build passed.
- Production Vercel inspect confirmed deployment `dpl_5ukbrgCvpUFWZC94nUQ4wArLe3RB`
  is `Ready` and aliased to `https://game-bling.vercel.app`.
- Live smoke confirmed Belgium vs Egypt (`1489377`) lineup page HTML includes
  current ESPN lineup names such as `Thibaut Courtois` and `Kevin De Bruyne`.

## Deployment Requirements

Production and local env vars:

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

Server-only secrets must not be committed:

- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET`
- `SYNC_JOB_SECRET`
- `API_FOOTBALL_KEY`

Football sync now uses the provider abstraction. ESPN is the active no-key provider for live/final scores, lineups, stats, and scorer events; API-Football remains wired as a fallback for when account access is restored.

Important ESPN details behavior:

- Local match rows can still store API-Football IDs such as `1489377`.
- ESPN resolves those rows by kickoff date plus team names/codes. For Belgium vs
  Egypt on June 15, 2026, local API-Football id `1489377` resolves to ESPN event
  `760426`.
- ESPN sometimes returns `rosters` team shells before player arrays are present.
  As of `1e304a7`, those shells are treated as `lineupsStatus:
  "unavailable"` instead of caching an "available" empty lineup.
- Match-detail fetch logs now include:
  - `[match-details.cache] fetch_start`
  - `[espn.details] summary_response`
  - `[espn.details] normalized`
  - `[match-details.cache] fetch_success`
  These logs include response status, resolved event id, lineup count, player
  count, statistics count, and raw roster counts.
- Belgium vs Egypt cache was manually refreshed after final lineups appeared:
  2 lineups, 51 players, 22 starters saved in Supabase.

The project must use the public npm registry. Keep `.npmrc` and
`package-lock.json` free of private/company registry URLs.

## Supabase Notes

Current production SQL files:

- `db/migrations/0001_initial_schema.sql`
- `db/migrations/0002_match_details.sql`
- `db/migrations/0003_room_invite_code.sql`
- `db/seeds/world-cup-2026.sql`

No SQL change is needed for removing visible PINs. The `pin_hash` column remains
in the schema and is filled internally.

Run `0003_room_invite_code.sql` in production if the app logs:

```text
Could not find the 'invite_code' column of 'rooms' in the schema cache
```

Then reload PostgREST schema with:

```sql
notify pgrst, 'reload schema';
```

## Current Known Limits

- Session model remembers up to 12 room/player sessions in the current browser,
  not a full account across devices.
- A player cannot yet recover identity on a new device.
- The global leaderboard is still basic and should eventually get better empty
  and real-data states.
- API-FOOTBALL scorer event team IDs are not mapped to local `teams`, so
  first/last scorer official scoring needs a provider team mapping field.
- ESPN is unofficial and can change response shapes. Keep defensive parsing and
  source-specific logs around provider boundaries.
- ESPN summary statistics may be unavailable even when lineup players are
  available.
- Smoke tests and manual production checks can create real test rooms; add cleanup later.

## Next Useful Improvements

- Add real history rows once final match scoring lands in production.
- Add a production health endpoint for missing env var names and unapplied DB
  migrations without exposing values.
- Add cleanup for smoke-test rooms.
- Add provider team ID mapping for scorer markets.
- Improve `/r/[slug]/matches` UX. The current generic match-card list repeats
  the matchup and should become a compact match-center page with one live/up-next
  hero and scannable remaining fixtures.
- Add a simple recovery/linking flow only if users actually need cross-device
  continuity.
