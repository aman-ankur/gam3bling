# Session Handoff: 2026-06-15

This note captures the product, UX, deployment, and verification state after the
post-launch polish pass.

## Current Live State

- Production URL: `https://game-bling.vercel.app`
- GitHub repo: `aman-ankur/gam3bling`
- Branch: `main`
- Commit style: all work remains squashed into one launch commit.
- Latest pushed commit at the time of this note: `a6cd5ac`
- Vercel project: `aman-ankurs-projects/game-bling`
- Production deploy path: normal Vercel cloud build, not prebuilt.

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
  - Current open fixtures first.
  - Room score/leaderboard preview next.
  - History/results preview after that.
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
- Saved match flow:
  - `app/r/[slug]/matches/[matchId]/page.tsx`
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

Results:

- Unit tests: 44/44 passed.
- Browser tests: 15/15 passed.
- Production Vercel cloud build passed.
- Live smoke confirmed:
  - Room creation works.
  - Prediction saving works.
  - Deployed saved-prediction page includes compact receipt markup.

## Deployment Requirements

Production and local env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
SYNC_JOB_SECRET=
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

Server-only secrets must not be committed:

- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET`
- `SYNC_JOB_SECRET`
- `API_FOOTBALL_KEY`

The project must use the public npm registry. Keep `.npmrc` and
`package-lock.json` free of private/company registry URLs.

## Supabase Notes

Current production SQL files:

- `db/migrations/0001_initial_schema.sql`
- `db/seeds/world-cup-2026.sql`

No SQL change is needed for removing visible PINs. The `pin_hash` column remains
in the schema and is filled internally.

## Current Known Limits

- Session model remembers the current browser/player room, not a full account
  across devices.
- A player cannot yet recover identity on a new device.
- The global leaderboard is still basic and should eventually get better empty
  and real-data states.
- API-FOOTBALL scorer event team IDs are not mapped to local `teams`, so
  first/last scorer official scoring needs a provider team mapping field.
- Smoke tests create real test rooms; add cleanup later.

## Next Useful Improvements

- Add a current-room list that can include multiple rooms per browser/player.
- Add real history rows once final match scoring lands in production.
- Add a production health endpoint for missing env var names without exposing
  values.
- Add cleanup for smoke-test rooms.
- Add provider team ID mapping for scorer markets.
- Add a simple recovery/linking flow only if users actually need cross-device
  continuity.
