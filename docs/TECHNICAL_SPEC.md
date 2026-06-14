# Game Bling Technical Specification

Date: 2026-06-15
Status: Implemented MVP, current technical reference

## 1. System Overview

Game Bling is a Next.js web app with Supabase Postgres as the system of record. The app is designed around a seeded fixture database, lightweight player identity, room memberships, predictions, scoring, and leaderboard queries.

The system must work even when the live football API is unavailable. External match data is treated as an enhancement layer that updates local match records.

## 2. Runtime Architecture

Primary runtime pieces:

- **Next.js app:** mobile UI, route handlers, server actions, and API endpoints.
- **Supabase Postgres:** persistent data for rooms, players, fixtures, predictions, scoring, and sync logs.
- **Scheduled sync job:** updates match status/results from the football data provider.
- **Scoring service:** recalculates prediction scores after match updates.
- **Provider adapter:** isolates API-Football specifics from the rest of the app.

Recommended deployment:

- Vercel hosts the Next.js app.
- Supabase hosts Postgres.
- Vercel Cron or a protected server route triggers sync jobs.

Local development:

- The app must run on `http://127.0.0.1:3003` only.
- If port `3003` is occupied, stop the occupying process and reuse `3003`.
- Do not silently switch to another local port.
- The `npm run dev` script enforces this with `scripts/ensure-port-free.mjs`.
- The visible home-page brand is `Gam3Bling`.

## 3. Route Structure

Initial route map:

- `/`: home, room shortcuts for the current browser session, create/join entry, next fixtures, and leaderboard preview.
- `/new`: create room.
- `/r/[slug]`: invite/join screen for new visitors, or room hub for returning/session players.
- `/r/[slug]/matches`: match schedule.
- `/r/[slug]/matches/[matchId]`: match detail, prediction entry, compact saved receipt, friends' predictions, and expandable edit form.
- `/r/[slug]/leaderboard`: room leaderboard.
- `/leaderboard`: global leaderboard.
- `/profile`: current player profile and avatar settings.
- `/api/sync/football`: protected sync endpoint.
- `/api/scoring/recalculate`: protected/manual scoring endpoint for testing and recovery.

Design decision: keep the room slug in most app routes so shared links and browser refreshes preserve context.

## 4. Data Model

Use UUID primary keys unless a table has a natural composite key.

### `tournaments`

Purpose: stores sports/tournament metadata.

Required fields:

- `id uuid primary key`
- `name text not null`
- `sport text not null`
- `season text not null`
- `status text not null`
- `theme jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

### `teams`

Purpose: stores teams that can appear in matches.

Required fields:

- `id uuid primary key`
- `name text not null`
- `short_code text not null`
- `flag_code text`
- `crest_url text`
- `created_at timestamptz not null default now()`

Recommended constraints:

- Unique `short_code` within the initial seeded dataset.

### `matches`

Purpose: stores fixtures, local lock source, and synced result fields.

Required fields:

- `id uuid primary key`
- `tournament_id uuid not null references tournaments(id)`
- `home_team_id uuid not null references teams(id)`
- `away_team_id uuid not null references teams(id)`
- `kickoff_at timestamptz not null`
- `stage text not null`
- `group_name text`
- `status text not null`
- `home_score integer`
- `away_score integer`
- `home_halftime_score integer`
- `away_halftime_score integer`
- `winner text`
- `first_scoring_team_id uuid references teams(id)`
- `last_scoring_team_id uuid references teams(id)`
- `api_provider text`
- `api_match_id text`
- `last_synced_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended indexes:

- `(tournament_id, kickoff_at)`
- `(status, kickoff_at)`
- `(api_provider, api_match_id)`

Design decision: kickoff locking uses `kickoff_at` from this table, not external API status.

### `rooms`

Purpose: stores friend prediction rooms.

Required fields:

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `invite_code_hash text not null`
- `creator_player_id uuid references players(id)`
- `created_at timestamptz not null default now()`

Design decision: store only invite code hash. The raw invite code is shown when generated and can be shared by the creator.

### `players`

Purpose: stores lightweight identity.

Required fields:

- `id uuid primary key`
- `display_name text not null`
- `pin_hash text not null`
- `session_token_hash text`
- `avatar_color text not null`
- `avatar_badge text not null`
- `avatar_initials text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Design decision: players are not Supabase Auth users in MVP. The app owns lightweight player identity.

Current product decision: users are not asked for a PIN. The legacy `pin_hash` column remains `not null` for compatibility, and the server fills it with a random internal secret when creating players. Same-device continuity is handled by the signed session cookie.

### `room_members`

Purpose: links players to rooms.

Required fields:

- `room_id uuid not null references rooms(id)`
- `player_id uuid not null references players(id)`
- `role text not null default 'member'`
- `joined_at timestamptz not null default now()`

Primary key:

- `(room_id, player_id)`

### `predictions`

Purpose: stores one player's prediction and score breakdown for one match.

Required fields:

- `id uuid primary key`
- `match_id uuid not null references matches(id)`
- `player_id uuid not null references players(id)`
- `final_home_score integer not null`
- `final_away_score integer not null`
- `match_result text not null`
- `halftime_home_score integer not null`
- `halftime_away_score integer not null`
- `first_scoring_team_id uuid references teams(id)`
- `last_scoring_team_id uuid references teams(id)`
- `locked_at timestamptz`
- `submitted_at timestamptz not null default now()`
- `score_final integer not null default 0`
- `score_result integer not null default 0`
- `score_halftime integer not null default 0`
- `score_first_scorer integer not null default 0`
- `score_last_scorer integer not null default 0`
- `score_total integer not null default 0`
- `scored_at timestamptz`

Recommended constraints:

- Unique `(match_id, player_id)`.
- Scores must be non-negative.
- Score fields are updated only by scoring service.

Design decision: one prediction per player per match keeps the global leaderboard clean if a player joins multiple rooms.

### `sync_logs`

Purpose: records provider sync attempts.

Required fields:

- `id uuid primary key`
- `provider text not null`
- `sync_type text not null`
- `status text not null`
- `message text`
- `created_at timestamptz not null default now()`

## 5. Server APIs And Actions

### Room Actions

- `createRoom(name, creatorProfile)`
  - Creates player with display name and generated avatar initials.
  - Creates room slug and invite code.
  - Stores hashed invite code.
  - Adds creator as admin member.
  - Sets signed player session cookie.

- `joinRoom(slug, inviteCode, playerProfile)`
  - Validates invite code.
  - Creates player with display name and generated avatar initials.
  - Adds room membership.
  - Sets signed player session cookie.

- `joinRoomByCode(formData)`
  - Lets a player join directly from home with invite code + display name.
  - Looks up the room by hashed invite code.
  - Creates membership, sets session, and redirects to the room match center.

### Player Actions

- `updateProfile(playerId, avatar)`
  - Updates avatar color, badge, and initials.

Current MVP note: cross-device recovery is intentionally not implemented. Reopen on the same device is powered by the HTTP-only session cookie.

### Prediction Actions

- `upsertPrediction(playerId, matchId, predictionInput)`
  - Loads match.
  - Rejects update if current time is after kickoff.
  - Validates score values and team choices.
  - Inserts or updates the unique player/match prediction.

- `getPredictionReceipt(playerId, matchId)`
  - Returns saved prediction, lock state, and score breakdown if scored.
  - UI renders the saved state as a compact receipt first.
  - Full prediction controls move into an expandable edit panel until kickoff.

### Scoring Actions

- `scoreMatch(matchId)`
  - Loads match result fields.
  - Scores all predictions for the match.
  - Leaves first/last scorer scores at zero and unfinalized if scorer data is unavailable.
  - Updates score fields idempotently.

### Sync Actions

- `syncMatches(window)`
  - Calls provider adapter.
  - Updates local match records.
  - Writes sync logs.
  - Triggers scoring for newly final matches.

## 6. Scoring Logic

Scoring should be implemented as a pure function:

```ts
type ScoreBreakdown = {
  scoreFinal: number;
  scoreResult: number;
  scoreHalftime: number;
  scoreFirstScorer: number;
  scoreLastScorer: number;
  scoreTotal: number;
  pendingMarkets: string[];
};
```

Rules:

- Final score exact match: 10 points.
- Match result exact match: 5 points.
- Half-time score exact match: 6 points.
- First team to score exact match: 4 points.
- Last team to score exact match: 4 points.

Pending behavior:

- If final score is unavailable, do not score the match.
- If half-time score is unavailable, leave half-time score at 0 and mark pending.
- If first/last scorer data is unavailable, leave that market at 0 and mark pending.

Design decision: keep pending markets explicit so the UI can say "awaiting official data" rather than hiding the reason.

## 7. Session And Security

MVP security posture:

- Hash invite codes server-side.
- Populate the legacy `players.pin_hash` column with a server-generated random secret; users do not enter PINs.
- Store local session token in an HTTP-only cookie when practical.
- Store only token hashes in the database.
- Do not expose raw invite codes after creation unless the creator has them locally.
- Protect sync/scoring endpoints with a server secret.
- Do not use service-role Supabase keys in browser code.

This is not high-assurance auth. It is intentionally lightweight because the product has no payments and no real-money betting.

## 8. UX Responsiveness

Writes use Next server actions, so Vercel + Supabase latency can take a couple of seconds. All submit buttons that trigger writes should use `components/submit-button.tsx`, which wraps React `useFormStatus`.

Required pending labels:

- Create room: `Creating room...`
- Home join: `Joining room...`
- Invite-link join: `Entering room...`
- Save prediction: `Saving predictions...`

Buttons also set `aria-busy`, disable while pending, and use a subtle pressed/pending visual state in `app/globals.css`.

## 9. API Provider Contract

Provider interface:

```ts
type ProviderMatchUpdate = {
  apiMatchId: string;
  status: "scheduled" | "live" | "halftime" | "final" | "postponed";
  homeScore?: number;
  awayScore?: number;
  homeHalftimeScore?: number;
  awayHalftimeScore?: number;
  firstScoringTeamExternalId?: string;
  lastScoringTeamExternalId?: string;
  kickoffAt?: string;
};
```

Provider responsibilities:

- Fetch updates for known match IDs or date windows.
- Normalize provider-specific status values.
- Return partial updates without throwing when optional fields are missing.
- Surface quota/auth failures in a structured way.

App responsibilities:

- Map provider team/match IDs to local IDs.
- Decide whether a partial update is enough to score.
- Write sync logs.

## 10. Query Patterns

Home:

- Query current player session and current room shortcut.
- Query upcoming matches where kickoff is soon.
- Query current player's prediction status per match.
- Query live/recent matches.
- Query top room leaderboard rows.

Room leaderboard:

- Join `room_members` to `players`.
- Sum `predictions.score_total` by player.
- Rank descending.

Global leaderboard:

- Sum `predictions.score_total` by player.
- Rank descending.
- Do not join through rooms to avoid double-counting.

Match detail:

- Query match + teams.
- Query current player's prediction.
- Query room members' predictions so friends can compare immediately after saving.

## 11. Testing Requirements

Unit tests:

- Scoring exact final score.
- Scoring match result without exact score.
- Scoring half-time score.
- Scoring first/last scorer.
- Pending scorer markets.
- Zero-point cases.
- Kickoff lock boundary.

Integration tests:

- Create room.
- Join room with invite code.
- Return to room from current browser session.
- Submit prediction before kickoff.
- Reject prediction after kickoff.
- Score match and update leaderboard.
- Show compact saved prediction receipt with expandable edit form.
- Show room hub and home room shortcut.
- Show pending states for write buttons.

Browser checks:

- Join flow at 390px width.
- Home room shortcuts and urgency feed at 390px width.
- Prediction form at 390px width.
- Saved prediction receipt and friends' predictions at 390px width.
- Leaderboard and room invite screens at 390px width.

## 12. Environment Variables

Expected variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET`
- `SYNC_JOB_SECRET`
- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL`

Only public Supabase values may be exposed to the browser.

## 13. Implementation Constraints

- Keep MVP tables direct and readable.
- Do not introduce generic prediction-market tables until markets become configurable.
- Do not add photo uploads until basic avatar selection ships.
- Do not require live API data for prediction entry.
- Keep UI state names aligned with match status names.
- Keep seed data and provider mappings versioned in the repo.
