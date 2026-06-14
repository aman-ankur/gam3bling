# Action-Triggered Match Details Design

Date: 2026-06-15
Status: Approved for implementation planning

## Goal

Add match-detail tabs to the mobile match page so a player can predict a match while also seeing useful football context: lineups, formations, players, and match stats.

The data must come from the football API and be stored once per match. Rooms should never fetch or own their own copy of lineup data. All rooms that show the same match should read the same cached match details.

Use the visible product brand and language already established in the app: `Gam3Bling`, "predictions", and "matches". Do not introduce visible "slip" or "pick" copy even if internal component names still include pick.

## Product Scope

The first version adds three tabs to `/r/[slug]/matches/[matchId]`:

- `Predictions`: existing saved prediction, friends' predictions, and edit form.
- `Lineups`: home/away team toggle, formation label, and a football pitch with starting players placed by formation.
- `Stats`: provider-backed match facts and team statistics when available.

If the API does not have lineups or stats yet, the app should show the exact unavailable state "Lineups are not confirmed yet" instead of fake player data.

## Fetching Strategy

Use action-triggered caching rather than broad scheduled fetching.

The primary trigger is when eligible prediction matches come into view:

1. The app loads room matches from local match data.
2. The server computes which matches are currently eligible for prediction.
3. For those match IDs, the server checks the match-detail cache.
4. Missing or stale details are fetched from API-Football.
5. Fetched data is normalized and stored once by local `match_id`.
6. All room pages render from the stored data.

The fallback trigger is the match detail page:

1. A user opens `/r/[slug]/matches/[matchId]`.
2. If the match is eligible for prediction and details are missing or stale, the server attempts one API fetch.
3. The page renders the newly cached details, or an unavailable state if the provider has no data yet.

Do not fetch lineups at room creation time. Room creation is not related enough to a specific match, and multiple rooms would create duplicate provider pressure.

## Data Model

Add match-scoped tables.

### `match_details`

One row per match that records provider sync state.

Fields:

- `match_id uuid primary key references matches(id) on delete cascade`
- `provider text not null`
- `status text not null`
- `lineups_status text not null`
- `stats_status text not null`
- `last_fetched_at timestamptz`
- `last_success_at timestamptz`
- `last_error text`
- `raw_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed status values should distinguish `missing`, `available`, `unavailable`, and `failed`.

### `match_lineups`

One row per match/team.

Fields:

- `id uuid primary key`
- `match_id uuid not null references matches(id) on delete cascade`
- `team_id uuid not null references teams(id)`
- `provider_team_id text`
- `formation text`
- `coach_name text`
- `source_updated_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique key:

- `(match_id, team_id)`

### `match_lineup_players`

One row per player in a stored lineup.

Fields:

- `id uuid primary key`
- `match_lineup_id uuid not null references match_lineups(id) on delete cascade`
- `provider_player_id text`
- `player_name text not null`
- `shirt_number integer`
- `position text`
- `grid text`
- `role text not null`
- `sort_order integer not null`
- `created_at timestamptz not null default now()`

Allowed `role` values:

- `starter`
- `substitute`

The `grid` field stores provider placement such as API-Football's lineup grid value. The UI can convert it into pitch coordinates without inventing positions.

### `match_team_statistics`

One row per match/team/stat name.

Fields:

- `id uuid primary key`
- `match_id uuid not null references matches(id) on delete cascade`
- `team_id uuid not null references teams(id)`
- `stat_name text not null`
- `stat_value text`
- `sort_order integer not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique key:

- `(match_id, team_id, stat_name)`

## Provider Layer

Extend the existing football provider boundary with match-detail fetching.

New provider method:

```ts
fetchMatchDetails(apiMatchId: string): Promise<ProviderMatchDetails>
```

The normalized return should include:

- `apiMatchId`
- `lineups`
- `statistics`
- provider availability status
- optional raw payload for debugging

API-Football should fetch lineups and statistics for one fixture ID at a time. The provider should normalize missing provider data into an unavailable status, not an exception. Auth, quota, and network errors should remain failures and be stored in `match_details.last_error`.

Provider team IDs must be mapped to local `teams.id` values before storing team-scoped rows. The current scorer-market sync does not yet map API-Football team IDs to local team IDs, so this feature should add a reusable mapping path rather than hard-coding lineup-only logic.

## Application Service

Add a service such as `ensureMatchDetailsForPredictionWindow(matches)`.

Responsibilities:

- Accept local matches that are currently prediction-eligible.
- Skip matches without numeric API-Football fixture IDs.
- Skip matches with fresh cached details.
- Fetch missing/stale details.
- Store normalized lineups, players, and stats transactionally where practical.
- Return a compact summary for logging and tests.

Required environment variables are:

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL`, defaulting to `https://v3.football.api-sports.io`

Freshness policy:

- If lineups are available, treat them as stable for 24 hours before kickoff and 7 days after kickoff.
- If lineups are unavailable, retry after a short cooldown such as 30 minutes.
- If a fetch failed because of provider/network/auth errors, retry after a cooldown and show the existing unavailable/error state.

## UI Design

The match page should keep the current hero and prediction content, but put the main body behind tabs.

Tab order:

1. `Predictions`
2. `Lineups`
3. `Stats`

On mobile, tabs should be horizontally scrollable if needed and must not hide the existing bottom nav.

### Lineups Tab

Show:

- home/away segmented control
- team name, formation, and lineup status
- football pitch
- player markers positioned from provider grid values when available
- starter list under the pitch for accessibility and overflow names
- substitutes in a compact list below starters

If formation/grid is missing but player names exist, show grouped player lists by role instead of trying to invent a formation.

### Stats Tab

Show:

- match status and score if available
- two-column team stat comparison for available provider stats
- an unavailable state if provider stats are not present yet

## Error Handling

- API data should enhance the match page but must not block predictions.
- Missing details render a useful unavailable state.
- Provider failure stores `last_error` for diagnosis.
- Repeated fetch attempts should respect cooldowns to avoid wasting quota.
- The UI should not expose raw provider errors to normal users.

## Testing

Unit tests:

- provider normalizes API-Football lineups into starters/substitutes with formation and grid.
- provider normalizes unavailable lineups without throwing.
- match-detail service fetches only eligible matches with missing/stale cache.
- match-detail service skips fresh cache.
- match-detail service stores lineups once per match/team.

Component tests or focused render checks:

- match page defaults to `Predictions`.
- `Lineups` tab shows a pitch when starters with grid values exist.
- `Lineups` tab shows unavailable state when the API has not released data.
- `Stats` tab shows team comparison when stats exist.

Browser checks:

- 390px mobile match page with tabs.
- 390px lineup pitch with no overlapping text or clipped tab labels.

Before shipping, run the established project checks:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

Local development and browser verification must use `http://127.0.0.1:3003`.

## Out Of Scope

- Manual lineup editing.
- Player photos.
- Betting odds.
- AI insights.
- User predictions about individual player events.
- Fetching match details for every fixture in the tournament before users ask for them.
