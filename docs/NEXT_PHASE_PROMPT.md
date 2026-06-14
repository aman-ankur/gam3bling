# Next Chat Prompt: Game Bling Deployable MVP And Live Scores

Update 2026-06-15: this prompt is historical. Use
`docs/NEXT_CHAT_PROMPT_2026-06-15.md` for the current production state.

Copy this prompt into the next Codex chat to continue from the current state.

```text
We are building Game Bling in /Users/aankur/workspace/game-bling.

Current status:
- Game Bling is a mobile-first World Cup prediction room app.
- Visible brand: Gam3Bling.
- Local dev must always run on http://127.0.0.1:3003 only.
- If port 3003 is occupied, kill the process using it and restart on 3003.
- The repo's npm run dev script enforces this with scripts/ensure-port-free.mjs.

Stack:
- Next.js 15 App Router
- TypeScript
- React
- Supabase
- Vitest
- Playwright
- ESLint

Important product decisions:
- Use name + PIN, not full auth.
- Players are lightweight app-owned identities, not Supabase Auth users.
- Store only invite code hashes, not raw invite codes.
- Use generated avatar initials/color/badge first.
- Predictions are one per player per match, not per room.
- Score breakdown is stored directly on predictions rows for MVP simplicity.
- Fixtures are seeded upfront; live provider sync is an enhancement.
- Match times must display in IST and show hours/minutes to kickoff with a live timer.

Completed work and commits:
- Phase 0 foundation and tests.
- Phase 1 schema and sample fixtures.
- Phase 2 player identity and room code helpers.
- Phase 3 prediction locking and scoring engine.
- Phase 4 MVP screens.
- Deployable MVP wiring:
  - Commit ec52c68 feat: wire deployable prediction MVP
  - Supabase server helper in lib/supabase/server.ts
  - Signed player session cookie helper in features/players/session.ts
  - Room create/join server actions in features/rooms/actions.ts
  - Supabase/fallback room data in features/rooms/data.ts
  - Supabase/fallback fixtures in features/matches/data.ts
  - Bundled World Cup fixture data in features/fixtures/world-cup-2026.ts
  - Prediction save action in features/predictions/actions.ts
  - Supabase/fallback leaderboards in features/leaderboards/data.ts
  - IST time/countdown helpers in features/time/match-time.ts
  - Protected scoring route in app/api/scoring/recalculate/route.ts
  - Deploy docs in docs/DEPLOYMENT.md
  - Supabase fixture seed SQL in db/seeds/world-cup-2026.sql

Current app behavior:
- /new creates a room in Supabase, creates the creator player, adds admin membership, sets a signed session cookie, and redirects to /r/[slug]?invite=CODE.
- /r/[slug] lets friends join with invite code, display name, and PIN.
- /r/[slug]/matches lists seeded World Cup fixtures, shows kickoff in IST, and shows a live countdown.
- /r/[slug]/matches/[matchId] lets the current session save all five MVP prediction markets before kickoff.
- Locked matches render read-only after kickoff.
- /r/[slug]/leaderboard and /leaderboard read prediction score totals from Supabase when available, with fallback data for local/e2e.
- /api/scoring/recalculate checks SYNC_JOB_SECRET and recalculates scores for matches whose result fields are populated.

Required Supabase production setup:
1. Open Supabase SQL Editor.
2. Run db/migrations/0001_initial_schema.sql if not already run.
3. Run db/seeds/world-cup-2026.sql to load the currently bundled fixtures.
4. Confirm the env vars are set in local .env.local and in Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - APP_SESSION_SECRET
   - SYNC_JOB_SECRET
   - API_FOOTBALL_KEY
   - API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
5. API_FOOTBALL_KEY may still be empty for seeded prediction entry, but it is needed for live score sync.

Verification already passed after ec52c68:
- npm run lint
- npm test
- npm run build
- npm run test:e2e

Next work to complete:
1. Implement live football provider sync:
   - Create features/sync/provider.ts.
   - Create features/sync/api-football-provider.ts.
   - Create features/sync/provider.test.ts.
   - Normalize provider statuses to scheduled/live/halftime/final/postponed.
   - Handle missing optional event data without throwing.
   - Use API_FOOTBALL_KEY and API_FOOTBALL_BASE_URL.
2. Implement protected sync route:
   - Create app/api/sync/football/route.ts.
   - Create features/sync/sync-matches.ts.
   - Route must check SYNC_JOB_SECRET.
   - Sync must write sync_logs.
   - Final match updates should trigger scoring recalculation.
3. Make deployment production-ready:
   - Deploy on Vercel.
   - Add all environment variables in Vercel.
   - Run Supabase seed SQL in production.
   - Create one room, join with a second browser/device, submit predictions, manually or API-sync a result, run scoring, verify leaderboards.
4. Optional but useful before sharing widely:
   - Add profile/recover-player flow.
   - Add clearer error UI for invalid invite code/PIN.
   - Add room admin copy-invite behavior with clipboard.
   - Expand fixture seed to the full World Cup schedule or rely fully on API sync.

Rules for the next worker:
- Keep local dev on http://127.0.0.1:3003 only.
- Follow TDD for new helper/sync logic.
- Use official docs or provider docs when implementing live API behavior.
- For browser-visible changes, run npm run test:e2e.
- Run npm run lint, npm test, npm run build before committing.
- Keep docs/DEPLOYMENT.md and docs/MVP_BUILD_PLAN.md updated.
```
