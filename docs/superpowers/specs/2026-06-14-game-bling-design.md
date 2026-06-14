# Game Bling World Cup Prediction App Design

Date: 2026-06-14
Status: Approved product design, pending implementation plan

Update 2026-06-15: this is the original planning spec. The current shipped
product removes visible PINs, uses room code + display name for joining, adds a
home `Your rooms` shortcut, uses `/r/[slug]` as a room hub for returning
players, and collapses saved predictions into a compact receipt with an
expandable edit form. Use `docs/SESSION_HANDOFF_2026-06-15.md`,
`docs/PRD.md`, and `docs/TECHNICAL_SPEC.md` as the current references.

## Related Documents

- Project overview: `ABOUT.md`
- Product requirements: `docs/PRD.md`
- Phased implementation and technical plan: `docs/IMPLEMENTATION_PLAN.md`
- Technical specification: `docs/TECHNICAL_SPEC.md`
- Interactive mockup: `mockuup/index.html`
- Single-file all-flows mockup: `mockuup/all-flows-single.html`

## Goal

Build a mobile-first web app for small friend groups to predict FIFA World Cup matches. The first version should be usable soon, deployed free on Vercel, backed by Supabase, and simple enough for 5-10 friends to join without login friction.

The app should feel like a World Cup match-night product, not a generic betting dashboard. The home screen should answer one question first: "What do I need to predict next?"

## MVP Scope

The MVP includes:

- Create a prediction room with a room name.
- Generate a short room link and one shared invite code.
- Join a room with display name, PIN, and avatar choice.
- Restore a player by name + PIN, with local session remembered on the device.
- Show preloaded World Cup fixtures.
- Highlight upcoming matches that need predictions.
- Let players submit five prediction markets before kickoff.
- Lock predictions automatically at kickoff.
- Sync match status/results from a football API where available.
- Score predictions after official or synced match data arrives.
- Show room and global leaderboards.
- Show profile/avatar in leaderboards, room members, and activity rows.

Out of scope for the first build:

- Email/password auth.
- Payments or real-money betting.
- Push notifications.
- Full admin console.
- Complex multi-sport support beyond a generic model foundation.
- Photo uploads for avatars.

## Product Flow

### Room Creation And Join

A room creator enters a room name. The app creates:

- A short room slug, for example `/r/AB12`.
- A shared invite code, for example `TIGER7`.

Invited users open the link, enter the invite code if required, choose a display name, set a PIN, and pick an avatar. The app stores a local session so returning on the same device is one tap. If a user changes devices, they can recover by entering name + PIN.

PINs are hashed. They are not stored as raw values.

### Home

Home is not a generic fixture list. It is an urgency feed:

- Top card: next match with missing predictions and lock countdown.
- Live now: score, minute/status, and projected points when possible.
- Recently scored: who gained points from completed matches.
- Mini leaderboard: room ranking movement.

### Matches

Matches provide the fuller tournament schedule:

- Upcoming, live, and finished sections.
- Group/knockout labels.
- Match cards that open the prediction/detail screen.
- Finished matches show official result, correct prediction answers, and earned points.

### Prediction Entry

Each match has one compact prediction form:

- Final score: 10 points.
- Match result: home/draw/away, 5 points.
- Half-time score: 6 points.
- First team to score: 4 points.
- Last team to score: 4 points.

Score predictions use simple steppers. Team/result choices use segmented controls. After saving, the player sees a private prediction receipt. After kickoff, predictions are locked and can become visible for room banter.

### Leaderboards

There are two leaderboard views:

- Room leaderboard for the current friend group.
- Global leaderboard across all players.

Rows show avatar, display name, total points, and a small secondary stat such as exact-score hits, streak, or last-match movement.

### Room

The room page shows:

- Room name.
- Short invite link.
- Shared invite code.
- Member list with avatars.
- Room creator/admin marker.

## UI Direction

The UI is mobile-first and should feel like a polished sports utility:

- Deep match-night base colors with pitch green action, gold highlights, and restrained team/flag color.
- Compact match-ticket cards.
- Sticky bottom navigation.
- Thumb-friendly controls.
- Clear countdowns and lock states.
- No desktop-style dense tables.
- Avatar + name visible wherever people appear.

The locked mockups live in:

- `mockuup/index.html` for the interactive prototype.
- `mockuup/all-flows-single.html` for a single-file all-flows overview.

## Data Model

Keep the model deliberately simple.

### `tournaments`

Stores tournament metadata.

Key fields:

- `id`
- `name`
- `sport`
- `season`
- `status`
- `theme`

### `teams`

Stores teams for a tournament/sport.

Key fields:

- `id`
- `name`
- `short_code`
- `flag_code`
- `crest_url`

### `matches`

Stores fixtures and synced results.

Key fields:

- `id`
- `tournament_id`
- `home_team_id`
- `away_team_id`
- `kickoff_at`
- `stage`
- `group_name`
- `status`
- `home_score`
- `away_score`
- `home_halftime_score`
- `away_halftime_score`
- `winner`
- `first_scoring_team_id`
- `last_scoring_team_id`
- `api_provider`
- `api_match_id`
- `last_synced_at`

### `rooms`

Stores friend groups.

Key fields:

- `id`
- `name`
- `slug`
- `invite_code_hash`
- `creator_player_id`
- `created_at`

### `players`

Stores lightweight player identity.

Key fields:

- `id`
- `display_name`
- `pin_hash`
- `avatar_color`
- `avatar_badge`
- `avatar_initials`
- `created_at`

### `room_members`

Links players to rooms.

Key fields:

- `room_id`
- `player_id`
- `role`
- `joined_at`

### `predictions`

Stores one player's prediction for one match. A player has one prediction per match across all rooms. Room leaderboards rank the predictions made by that room's members, and the global leaderboard uses the same prediction totals without double-counting players who join multiple rooms.

Key fields:

- `id`
- `match_id`
- `player_id`
- `final_home_score`
- `final_away_score`
- `match_result`
- `halftime_home_score`
- `halftime_away_score`
- `first_scoring_team_id`
- `last_scoring_team_id`
- `locked_at`
- `submitted_at`
- `score_final`
- `score_result`
- `score_halftime`
- `score_first_scorer`
- `score_last_scorer`
- `score_total`
- `scored_at`

### `sync_logs`

Tracks API sync attempts and failures.

Key fields:

- `id`
- `provider`
- `sync_type`
- `status`
- `message`
- `created_at`

## Match Data And Automation

Fixtures are seeded into Supabase upfront. This makes the app useful even if live data is delayed or unavailable.

API-Football is the recommended first provider because its free plan currently lists 100 requests/day and includes fixtures, livescore, events, statistics, predictions, and odds. Its coverage page includes World Cup. The implementation should verify the 2026 World Cup feed with an API key before relying on it.

The sync design should be adapter-based:

- `FootballDataProvider` interface.
- `ApiFootballProvider` implementation first.
- Future providers can be added without rewriting scoring or UI.

Scheduled sync behavior:

- Sync future fixtures occasionally.
- Sync upcoming matches more often near kickoff.
- Sync live matches frequently enough for a small friend group without burning quota.
- Sync recently finished matches to finalize scores.

The app locks predictions based on the local `matches.kickoff_at`, not API match status.

If goal event data is missing, first-team-to-score and last-team-to-score remain pending while final score, result, and half-time scoring can still complete.

## Scoring Rules

For each prediction:

- Final score exact match: 10 points.
- Match result exact match: 5 points.
- Half-time score exact match: 6 points.
- First team to score exact match: 4 points.
- Last team to score exact match: 4 points.

Scoring should be idempotent. Re-running scoring for a match should update the same prediction score fields and not duplicate points.

Leaderboards are calculated from prediction score totals. Avoid leaderboard snapshot tables in the MVP unless performance requires them later.

## Error Handling

The product should fail softly:

- If API sync fails, show seeded fixtures and stale status with a clear "last updated" state.
- If a match has final score but missing goal event data, show first/last scorer markets as awaiting official data.
- If a user tries to edit after kickoff, show a locked state and their saved receipt.
- If name + PIN recovery fails, show a simple retry message without exposing whether the name or PIN was wrong.
- If invite code is wrong, keep the join form and explain that the room code did not match.

## Testing And Verification

Implementation should include:

- Unit tests for all scoring rules.
- Unit tests for kickoff lock behavior.
- Integration tests for room creation, room join, prediction submit, match scoring, and leaderboard update.
- Seed-data validation for fixture imports.
- Mobile viewport checks for join, home, prediction entry, live match, leaderboard, room invite, and profile/avatar screens.

## Implementation Notes

Recommended stack:

- Next.js app deployed on Vercel.
- Supabase Postgres for data.
- Supabase Storage deferred until avatar image uploads are needed.
- Server routes or scheduled jobs for API sync and scoring.
- Environment variables for Supabase and football API keys.

The first implementation should prioritize a working friend-circle game over advanced live features. Live scoring, AI commentary, richer prediction markets, and push notifications can follow after the MVP is playable.
