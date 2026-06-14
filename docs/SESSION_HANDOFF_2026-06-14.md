# Session Handoff: 2026-06-14

Update 2026-06-15: this is the original launch handoff. The current product
state is captured in `docs/SESSION_HANDOFF_2026-06-15.md`; visible PINs were
removed, saved predictions now collapse into a compact receipt, home shows room
shortcuts, and `/r/[slug]` acts as a room hub for returning players.

This note captures what changed, what broke, and what we learned while getting
Gam3Bling ready for friends to use on Vercel.

## Final Production State

- Production URL: `https://game-bling.vercel.app`
- GitHub repo: `aman-ankur/gam3bling`
- Branch: `main`
- Commit style: all work squashed into one launch commit
- Vercel project: `aman-ankurs-projects/game-bling`
- Supabase is the production database for rooms, members, predictions, matches,
  and leaderboard data.

## Product Work Completed

- Built the MVP Next.js app for World Cup prediction rooms.
- Added Supabase schema and World Cup seed SQL.
- Added room creation with unique slug and invite code.
- Added room join flow with invite code and PIN.
- Added match list with only the next 4 scheduled matches open for predictions.
- Locked later fixtures behind a compact summary instead of an endless list.
- Added prediction form with these markets:
  - Final score
  - Match result
  - Half-time score
  - First team to score
  - Last team to score
- Added intelligent prediction behavior:
  - Final score auto-selects match result.
  - Draw auto-selects draw.
  - Impossible scorer choices are disabled.
  - Half-time score is clamped to final score constraints.
- Added room predictions board after saving picks.
- Added room/global leaderboard scaffolding.
- Reworked copy from "slip" to "picks" / "predictions".
- Replaced fake homepage data with real fixture data.
- Confirmed Germany vs Curacao is stored as `2026-06-14T17:00:00Z`, which
  displays as `14 Jun, 10:30 PM IST`.
- Removed fake live match state and fake private names from the homepage.

## Supabase Work

The database setup lives in:

- `db/migrations/0001_initial_schema.sql`
- `db/seeds/world-cup-2026.sql`

The user ran the World Cup SQL directly in Supabase SQL Editor and confirmed it
worked.

Required Vercel/local env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
SYNC_JOB_SECRET=
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

`SUPABASE_SERVICE_ROLE_KEY`, `APP_SESSION_SECRET`, and `SYNC_JOB_SECRET` must
stay server-only and must not be committed.

## Deployment Lessons

The hardest issue was deployment, not app logic.

### What Failed

Prebuilt Vercel deployment worked for static/dynamic pages but failed for Next
server actions:

```bash
npx --registry https://registry.npmjs.org vercel build --prod
npx --registry https://registry.npmjs.org vercel deploy --prebuilt --prod
```

The app deployed, but room creation failed at runtime:

```text
Supabase environment variables are required for room actions
```

Vercel Production did have the env var names, but the prebuilt output did not
attach runtime env to the server-action bundle. Passing `--env` at deploy time
and patching build-output function configs did not solve this reliably.

### What Fixed It

Use normal Vercel cloud deployment:

```bash
npx --registry https://registry.npmjs.org vercel deploy --prod --force
```

That lets Vercel build the app and attach Production env vars correctly.

### Why Normal Deploy Was Failing

Cloud install initially failed because npm was hitting internal errors and the
lockfile was resolved against a private company registry.

That was not appropriate for this public/personal project and made Vercel cloud
installs unreliable.

The durable fix:

- Added project `.npmrc` pointing to `https://registry.npmjs.org/`.
- Rewrote `package-lock.json` resolved URLs to `https://registry.npmjs.org/`.
- Confirmed zero private registry references remain in tracked npm files.
- Kept Vercel install on npm 10:

```json
{
  "installCommand": "corepack prepare npm@10.9.2 --activate && npm install --engine-strict=false --no-audit --no-fund"
}
```

### Dynamic Route Lesson

`/new` must remain dynamic:

```ts
export const dynamic = "force-dynamic";
```

Room creation uses a server action and needs runtime env/cookies. In a good
production build, the route table should show:

```text
ƒ /new
```

## Final Verification

Local checks that passed:

```bash
npx --registry https://registry.npmjs.org npm@10.9.2 ci --registry=https://registry.npmjs.org --engine-strict=false --no-audit --no-fund
npm run lint
npm test
```

Test results:

- Lint passed.
- Unit tests passed: 44 tests across 12 files.
- Production deploy succeeded through normal Vercel cloud build.
- Live room creation succeeded.

Production smoke result:

```text
Room creation redirected to /r/[generated-room-slug]?invite=[generated-code].
```

Recent Vercel logs after the fix showed:

```text
GET /new 200
POST /new 303 [rooms.create] start ...
GET /r/codex-smoke-... 200
```

## Known-Good Deployment Recipe

1. Ensure Supabase SQL has been run.
2. Ensure Vercel Production env vars are set.
3. Ensure `.npmrc` uses public npm.
4. Ensure `package-lock.json` has no private registry URLs.
5. Ensure `/new` is dynamic.
6. Run:

```bash
npm run lint
npm test
npx --registry https://registry.npmjs.org vercel deploy --prod --force
```

7. Smoke test `/new` by creating a temporary room.
8. Check Vercel logs for `POST /new 303`.

## Things To Avoid

- Do not deploy this app to production with `vercel deploy --prebuilt`.
- Do not let `package-lock.json` contain company/private registry URLs.
- Do not commit `.env.local` or any real secret values.
- Do not assume Vercel env changes apply to old deployments; redeploy after env
  changes.

## Next Useful Improvements

- Add a small production health endpoint that reports missing env var names
  without exposing values.
- Move room creation/join from server actions to API routes if we want simpler
  runtime observability.
- Add external team IDs to teams so API-FOOTBALL scorer events can map to local
  `first_scoring_team_id` and `last_scoring_team_id`.
- Add cleanup for test rooms created during smoke checks.
- Add a proper empty/global leaderboard state once real cross-room data is
  enough to show.
