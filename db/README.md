# Game Bling Database

This folder contains the Supabase Postgres schema and development seed data for Game Bling.

## Migrations

- `migrations/0001_initial_schema.sql` creates the MVP tables from `docs/TECHNICAL_SPEC.md`.
- UUID primary keys use Postgres `gen_random_uuid()` from the `pgcrypto` extension.
- The schema intentionally keeps identity lightweight: players use display names, avatar fields, and local session cookies rather than Supabase Auth users. The legacy `pin_hash` column is filled with an internal random secret for compatibility.
- Predictions are unique per `(match_id, player_id)` so a player has one global prediction per match even if they join multiple rooms.

Apply migrations through Supabase CLI or the Supabase SQL editor for the target project.

## Seeds

- `seeds/world-cup-sample.json` is a local development fixture set.
- `seeds/world-cup-2026.sql` loads the deployable MVP fixture schedule into Supabase.
- Seed data is validated by `db/validate-seed.test.ts`.
- The seed is not a live World Cup import. External provider sync can update local match records later, but prediction entry should work from seeded fixtures.
