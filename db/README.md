# Gam3bling Database

This folder contains the Supabase Postgres schema and development seed data for Gam3bling.

## Migrations

- `migrations/0001_initial_schema.sql` creates the MVP tables from `docs/TECHNICAL_SPEC.md`.
- `migrations/0002_match_details.sql` adds match-detail/cache fields used by lineups, stats, venue, and referee details.
- `migrations/0003_room_invite_code.sql` adds optional `rooms.invite_code` so room hubs can display and copy the join code after creation.
- UUID primary keys use Postgres `gen_random_uuid()` from the `pgcrypto` extension.
- The schema intentionally keeps identity lightweight: players use display names, avatar fields, and local session cookies rather than Supabase Auth users. The legacy `pin_hash` column is filled with an internal random secret for compatibility.
- Predictions are unique per `(match_id, player_id)` so a player has one global prediction per match even if they join multiple rooms.
- `rooms.invite_code_hash` remains the canonical join validator. `rooms.invite_code` is display/recovery data only and can be `null` for old rooms until a user verifies the original code again.

Apply migrations through Supabase CLI or the Supabase SQL editor for the target project.

## Seeds

- `seeds/world-cup-sample.json` is a local development fixture set.
- `seeds/world-cup-2026.sql` loads the deployable MVP fixture schedule into Supabase.
- Seed data is validated by `db/validate-seed.test.ts`.
- The seed is not a live World Cup import. External provider sync can update local match records later, but prediction entry should work from seeded fixtures.
