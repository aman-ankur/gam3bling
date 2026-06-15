# Game Bling Deployment Checklist

This is the current deployable MVP path for sharing Game Bling with friends.

## 1. Supabase

Run these SQL files in Supabase SQL Editor, in order:

1. `db/migrations/0001_initial_schema.sql`
2. `db/migrations/0002_match_details.sql`
3. `db/migrations/0003_room_invite_code.sql`
4. `db/seeds/world-cup-2026.sql`

The seed loads upcoming FIFA World Cup 2026 fixtures used by the app. Kickoff values are stored in UTC and displayed in IST in the UI.

If production is already on an older schema, run this SQL before depending on persistent room-code display:

```sql
alter table public.rooms
  add column if not exists invite_code text;

do $$
begin
  alter table public.rooms
    add constraint rooms_invite_code_format
    check (invite_code is null or invite_code ~ '^[A-Z0-9]{4,10}$');
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
```

The app is backward-compatible if this migration is not applied yet, but new/legacy rooms cannot persistently show the room code until the column exists. Existing old room codes cannot be recovered from `invite_code_hash`; enter the original code once through the room hub recovery form or by joining with that code to backfill `rooms.invite_code`.

## 2. Environment Variables

Set these locally and in Vercel:

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

ESPN is the default football sync provider and does not require a key. `ESPN_SOCCER_BASE_URL` is optional and only needed if the ESPN endpoint needs to be overridden.

`API_FOOTBALL_KEY` is optional while ESPN sync is active. Keep it configured when API-Football access is restored so it can remain available as a fallback provider.

Keep `SUPABASE_SERVICE_ROLE_KEY`, `APP_SESSION_SECRET`, and `SYNC_JOB_SECRET` server-only.

Production env can be copied from local `.env.local`, but never commit real values.
After changing Vercel env vars, trigger a fresh production deployment.

## 3. Vercel Deployment

Use the normal Vercel cloud build path:

```bash
npx --registry https://registry.npmjs.org vercel deploy --prod --force
```

Do not use the prebuilt path for production (`vercel build --prod` followed by
`vercel deploy --prebuilt --prod`) for this app. Prebuilt deployment succeeded
but did not attach Vercel runtime environment variables to the Next server-action
bundle, which caused room creation to fail with:

```text
Supabase environment variables are required for room actions
```

The app includes `.npmrc` so Vercel installs packages from the public npm
registry. Keep `package-lock.json` free of private registry URLs.

Expected production route table should show `/new` as dynamic:

```text
ƒ /new
```

`/new` must stay dynamic because it hosts the create-room server action.

## 4. Current User Flow

- Create a room at `/new`.
- Share the generated room link and invite code. Returning room hubs also show the invite link and room code below the Results ledger.
- Friends join with room code + display name.
- Returning players see a `Your rooms` shortcut on the home page for the current browser session.
- `/r/[slug]` acts as a room hub for returning players, with current fixtures, room score, and history preview.
- Players open `/r/[slug]/matches` or jump from the room hub to an open fixture.
- Players save predictions before kickoff.
- After saving, the match page shows a compact prediction receipt first, then friends' predictions, with the full prediction form inside an expandable edit section.
- Locked matches become read-only at kickoff.
- Room and global leaderboards read prediction score totals.
- Create/join/save buttons use pending labels and disabled states so users get immediate feedback while server actions run.
- If an older room has no stored visible code, the invite panel shows a legacy recovery form. Entering the original code verifies it against the hash and saves it for future display.

## 5. Live Football Sync

Run the protected sync route manually or from a Vercel Cron job:

```bash
curl -X POST https://YOUR_DEPLOYMENT_URL/api/sync/football \
  -H "x-sync-secret: YOUR_SYNC_JOB_SECRET"
```

The route:

- Requires `SYNC_JOB_SECRET`.
- Pulls fixture updates through the provider abstraction. ESPN is tried first, with API-Football kept as a fallback when configured.
- Updates `matches.status`, score fields, winner, kickoff time, and sync timestamps.
- Writes `sync_logs` rows for started, success, and failed attempts.
- Recalculates prediction scores when a synced match is final.

Provider adapters receive local match context, so ESPN can resolve matches by kickoff date plus team names/codes even when the row still stores an API-Football fixture id or an app-owned id like `wc2026-...`.

## 6. Manual Scoring Recovery

If the provider is unavailable, enter final match result fields directly in Supabase:

- `matches.home_score`
- `matches.away_score`
- `matches.winner`
- Optional: `home_halftime_score`, `away_halftime_score`, `first_scoring_team_id`, `last_scoring_team_id`

Then trigger scoring:

```bash
curl -X POST https://YOUR_DEPLOYMENT_URL/api/scoring/recalculate \
  -H "x-sync-secret: YOUR_SYNC_JOB_SECRET"
```

The route updates prediction score breakdowns and writes a `sync_logs` row.

## 7. Fixture Source

The bundled seed currently includes the June 14-17, 2026 World Cup fixtures from published schedule listings. Seeded fixtures make prediction entry work before every provider ID is available.

## 8. Current Live Score Limits

API-FOOTBALL goal events expose provider team IDs, but the current MVP schema does not store external team IDs for local teams. Sync therefore leaves `first_scoring_team_id` and `last_scoring_team_id` empty until a team mapping field is added.

## 9. Troubleshooting

### `Supabase environment variables are required for room actions`

Check these in order:

1. Vercel Production has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. The current production deployment was built after those env vars were set.
3. The deployment was a normal cloud build, not a prebuilt deployment.
4. `/new` is dynamic in the build output.

### `Could not find the 'invite_code' column of 'rooms' in the schema cache`

Run the `0003_room_invite_code` migration SQL above, including:

```sql
notify pgrst, 'reload schema';
```

Current code falls back to the legacy schema so create/join should not crash, but persistent room-code display needs the column.

### Vercel cloud install fails with npm internal errors

Make sure `.npmrc` points to `https://registry.npmjs.org/` and the lockfile
does not contain private registry URLs. The project previously had lockfile
URLs pointing at a company registry, which made Vercel cloud installs unreliable.

## 10. Pre-Share Checklist

Before sending a link to friends:

- Run `db/migrations/0001_initial_schema.sql` in Supabase.
- Run `db/migrations/0002_match_details.sql` in Supabase.
- Run `db/migrations/0003_room_invite_code.sql` in Supabase.
- Run `db/seeds/world-cup-2026.sql` in Supabase.
- Deploy to Vercel with all env vars set.
- Create a fresh room at `/new`.
- Join from a second browser or device.
- Submit a prediction for an unlocked match.
- Confirm the saved match page collapses to a one-line receipt and shows friends' predictions immediately below.
- Confirm the home page shows the joined room under `Your rooms` in the same browser.
- Confirm the room page opens as the room hub for that browser session.
- Confirm the same room shows the joined player and saved leaderboard row.
- Confirm the room hub invite panel shows both the invite link and room code, and that `Copy link + code` includes both values.
- Click create/join/save buttons during smoke testing and confirm they immediately switch to pending copy such as `Creating room...`, `Joining room...`, or `Saving predictions...`.
