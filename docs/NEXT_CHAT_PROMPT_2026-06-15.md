# Next Chat Prompt: Gam3Bling Current State

Copy this prompt into a fresh Codex chat to continue from the current production
state.

```text
We are working in /Users/aankur/workspace/game-bling.

Product:
- Visible brand: Gam3Bling.
- Mobile-first World Cup prediction rooms for small friend groups.
- Production URL: https://game-bling.vercel.app
- GitHub repo: aman-ankur/gam3bling
- Work is now in small focused commits on main.
- Latest functional commit before docs refresh: 0571c98.

Stack:
- Next.js 15 App Router
- TypeScript
- React server actions
- Supabase Postgres
- Vercel
- Vitest
- Playwright
- ESLint

Local dev:
- Run only on http://127.0.0.1:3003.
- npm run dev uses scripts/ensure-port-free.mjs to free and reuse 3003.

Deployment:
- Use normal Vercel cloud build:
  npx --registry https://registry.npmjs.org vercel deploy --prod --force
- Do not use vercel deploy --prebuilt --prod for production.
- Prebuilt deploy previously caused server actions to miss Vercel runtime env.
- Keep .npmrc and package-lock.json on https://registry.npmjs.org/.
- Never use the user's company/JFrog npm registry for this project.

Current product decisions:
- Users join with room code + display name. No visible PIN.
- The legacy players.pin_hash column remains for schema compatibility and is filled with a random internal server secret.
- Current-browser continuity uses a signed HTTP-only session cookie with up to 12 remembered room/player sessions.
- Home shows "Your rooms" shortcuts for the current browser session.
- Room hubs show the invite link and room code below the Results ledger.
- New rooms persist the visible room code in rooms.invite_code after db/migrations/0003_room_invite_code.sql is applied.
- Legacy rooms with invite_code = null cannot recover the original room code from invite_code_hash. They can backfill invite_code only when a user enters the original code again through the room hub recovery form or by joining with that code.
- /r/[slug] is a room hub for returning/session users:
  - current open fixtures
  - room score preview
  - history preview
  - invite link + room code panel
  New visitors still see the invite-code join form.
- /r/[slug]/matches lists open fixtures and locks later fixtures.
- /r/[slug]/matches/[matchId] supports:
  - final score
  - match result
  - half-time score
  - first team to score
  - last team to score
- After saving, match detail shows:
  - compact prediction receipt first
  - friends' predictions directly below
  - expandable Edit prediction panel for changes before kickoff
- Bottom nav is sticky/fixed, route-aware, and uses Matches instead of Picks.
- Visible copy should say predictions, not slips or picks.
- Server-action submit buttons must use components/submit-button.tsx so users see pending states:
  - Creating room...
  - Joining room...
  - Entering room...
  - Saving predictions...

Important files:
- app/page.tsx: home, room shortcuts, join by code, next fixtures.
- app/new/page.tsx: create room.
- app/r/[slug]/page.tsx: join screen or room hub.
- app/r/[slug]/matches/page.tsx: match list.
- app/r/[slug]/matches/[matchId]/page.tsx: prediction detail/saved receipt/edit flow.
- components/submit-button.tsx: pending submit states.
- components/room-invite-card.tsx: invite link/code copy UI and legacy room-code recovery form.
- components/prediction-receipt.tsx: compact saved prediction receipt.
- components/prediction-form.tsx: prediction form with initialPrediction support.
- components/room-picks-board.tsx: friends' predictions board; internal names still include pick, visible copy says prediction.
- features/rooms/actions.ts: createRoom, joinRoom, joinRoomByCode, rememberRoomInviteCode. Room create/join is backward-compatible if the rooms.invite_code migration is pending.
- features/rooms/data.ts: getRoomSummary, getCurrentPlayerRoomShortcuts.
- features/predictions/data.ts: room prediction data, including raw saved values for edit.
- mockuup/post-save-room-hub-flow.html: approved flow mockup for home, room hub, saved prediction, and history.
- docs/SESSION_HANDOFF_2026-06-15.md: latest handoff.
- docs/DEPLOYMENT.md: current deployment checklist.

Supabase migrations:
- db/migrations/0001_initial_schema.sql
- db/migrations/0002_match_details.sql
- db/migrations/0003_room_invite_code.sql
- db/seeds/world-cup-2026.sql

If production logs "Could not find the 'invite_code' column of 'rooms' in the schema cache", run 0003_room_invite_code.sql in Supabase SQL Editor and then:
  notify pgrst, 'reload schema';

Environment:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
SYNC_JOB_SECRET=
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io

Required verification before shipping:
- npm run lint
- npm test
- npm run build
- npm run test:e2e

Latest verified counts:
- Unit tests: 78/78
- Browser tests: 22/22

Known limits:
- Current session model remembers up to 12 room/player sessions in the browser, not a full account across devices.
- History section is currently a preview until scored final results exist.
- API-FOOTBALL scorer team IDs are not mapped to local team IDs yet, so first/last scorer official scoring needs provider team mapping.
- Smoke tests create real test rooms; cleanup should be added later.

Likely next useful work:
1. Improve real room history once final match scoring lands.
2. Add production health endpoint for missing env var names and unapplied DB migrations.
3. Add cleanup for smoke-test rooms.
4. Add provider team ID mapping for first/last scorer markets.
```
