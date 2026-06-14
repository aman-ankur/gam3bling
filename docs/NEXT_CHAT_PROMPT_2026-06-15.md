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
- Work is intentionally squashed into one launch commit on main.
- Latest known commit after June 15 polish: a6cd5ac.

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
- Current-browser continuity uses a signed HTTP-only session cookie.
- Home shows "Your rooms" shortcut for the current browser session.
- /r/[slug] is a room hub for returning/session users:
  - current open fixtures
  - room score preview
  - history preview
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
- components/prediction-receipt.tsx: compact saved prediction receipt.
- components/prediction-form.tsx: prediction form with initialPrediction support.
- components/room-picks-board.tsx: friends' predictions board; internal names still include pick, visible copy says prediction.
- features/rooms/actions.ts: createRoom, joinRoom, joinRoomByCode.
- features/rooms/data.ts: getRoomSummary, getCurrentPlayerRoomShortcuts.
- features/predictions/data.ts: room prediction data, including raw saved values for edit.
- mockuup/post-save-room-hub-flow.html: approved flow mockup for home, room hub, saved prediction, and history.
- docs/SESSION_HANDOFF_2026-06-15.md: latest handoff.
- docs/DEPLOYMENT.md: current deployment checklist.

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
- Unit tests: 44/44
- Browser tests: 15/15

Known limits:
- Current session model remembers one current room/player in the browser, not a full account across devices.
- Multiple-room shortcut support should be improved later.
- History section is currently a preview until scored final results exist.
- API-FOOTBALL scorer team IDs are not mapped to local team IDs yet, so first/last scorer official scoring needs provider team mapping.
- Smoke tests create real test rooms; cleanup should be added later.

Likely next useful work:
1. Improve real room history once final match scoring lands.
2. Add multiple-room support to Your rooms.
3. Add production health endpoint for missing env var names.
4. Add cleanup for smoke-test rooms.
5. Add provider team ID mapping for first/last scorer markets.
```
