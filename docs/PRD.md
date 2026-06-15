# Gam3bling PRD

Date: 2026-06-15
Status: Implemented MVP, current product reference

## 1. Summary

Gam3bling is a mobile-first World Cup prediction game for small friend groups. Users create a room, invite friends through a short link and shared code, join with room code + display name, predict match outcomes, and compete on room and global leaderboards.

The first release should be playable quickly on a free Vercel deployment with Supabase as the permanent database. It should prioritize the core friend-circle loop over advanced sports analytics.

## 2. Problem

During a tournament, friends often make casual predictions in chats. Those predictions are easy to lose, hard to score, and not very visual. Existing sports prediction or betting apps often feel too public, too gambling-oriented, or too login-heavy for a small group.

Gam3bling gives a room-based, lightweight alternative:

- No full account setup.
- Shared room identity.
- Simple prediction markets.
- Automatic scoring where data allows.
- A UI that makes the next required action obvious.

## 3. Target Users

Primary users:

- Friend groups of 5-10 people following the World Cup.
- Casual football fans who know enough to predict scores but do not want fantasy-league complexity.
- Room organizers who want a low-admin way to run a prediction game.

Secondary users:

- People who may join multiple friend rooms.
- Future tournament organizers for other sports.

## 4. Goals

- Make room creation and joining friction-light.
- Make upcoming predictions obvious on the home screen.
- Keep prediction entry fast on phone.
- Score the selected markets reliably.
- Show room and global standings clearly.
- Use seeded fixtures so the app works before API automation is perfect.
- Keep architecture adaptable for future sports/tournaments.

## 5. Non-Goals

- Real-money betting or payments.
- Email/password auth or social login.
- Complex admin console in the first release.
- Push notifications in the first release.
- Full fantasy sports mechanics.
- User-generated custom markets in the first release.
- Native iOS/Android apps.

## 6. Success Metrics

MVP success:

- A room creator can create and share a room in under 60 seconds.
- A friend can join and submit first predictions in under 90 seconds.
- At least five users can complete predictions for a match before kickoff.
- Predictions lock correctly at kickoff.
- Final score/result/half-time scoring works without manual database edits.
- Room leaderboard updates after a match is scored.

Quality metrics:

- Core mobile screens fit a 390px-wide viewport without awkward overflow.
- API failure does not block fixture display or prediction entry.
- Scoring is idempotent.
- A player joining multiple rooms is not double-counted in the global leaderboard.

## 7. User Stories

### Room Creator

- As a room creator, I can create a room with a memorable name so my friends recognize it.
- As a room creator, I can share a short link and invite code so friends can join quickly.
- As a room creator, I can see who has joined the room.

### Player

- As a player, I can join with room code + display name so I do not need an email/password account.
- As a player, I can pick an avatar so leaderboards feel personal.
- As a player, I can see which matches still need predictions.
- As a player, I can submit predictions quickly on my phone.
- As a player, I can see a compact saved prediction receipt, then expand the full form if I want to edit before kickoff.
- As a player, I can see friends' predictions immediately after saving mine.
- As a player, I can see how many points I earned after a match.
- As a player, I can open a finished match from history and see the conclusion view: final score, room predictions, and who scored.

### Returning Player

- As a returning player, I can reopen the app and remain recognized on the same device.
- As a returning player on the same device, I can use the home shortcut to return directly to my current room.
- As a returning player, I can recognize room shortcuts as tappable actions and jump straight into the current/live match context.

### Spectator/Competitor

- As a room member, I can see room leaderboard standings.
- As a player, I can see a global leaderboard across all rooms.
- As a room member, I can see room movement after matches to keep the game lively.
- As a room member, I can use the room hub to see current predictions, room score, and result history in one place.

## 8. Functional Requirements

### Rooms

- Create room with name.
- Generate unique short slug.
- Generate shared invite code.
- Store hashed invite code.
- Join room only with valid invite code.
- Show room member list.
- Support player membership in multiple rooms.

### Player Identity

- Create player with display name, avatar initials, avatar color, and avatar badge.
- Fill the legacy `pin_hash` database column with an internal random secret for compatibility; do not ask users for a PIN.
- Store a local session token for returning on same device.
- Avoid email/password flows.

### Fixtures And Matches

- Seed tournament fixtures into Supabase.
- Show upcoming/live/finished matches.
- Store kickoff time, stage, teams, status, scores, half-time score, first scoring team, and last scoring team.
- Lock predictions using stored kickoff time.

### Predictions

- One prediction per player per match.
- Prediction fields:
  - Final score.
  - Match result.
  - Half-time score.
  - First team to score.
  - Last team to score.
- Allow edits until kickoff.
- Make prediction read-only after kickoff.
- After save, show a compact one-line prediction receipt above friends' predictions.
- Put the detailed prediction form inside an expandable edit section when a saved prediction exists.

### Scoring

- Final score exact match: 10 points.
- Match result exact match: 5 points.
- Half-time score exact match: 6 points.
- First team to score exact match: 4 points.
- Last team to score exact match: 4 points.
- Store score breakdown on the prediction row.
- Recalculate scores idempotently.
- Keep first/last scorer pending if event data is missing.

### Leaderboards

- Room leaderboard ranks members by prediction totals.
- Global leaderboard ranks players once across all predictions.
- Show avatar, name, total points, and a secondary stat.
- Avoid leaderboard snapshot tables in MVP unless performance requires them.

### API Sync

- Use the provider interface for football data instead of calling a provider directly from product code.
- Prefer ESPN public soccer endpoints while API-Football account access is unavailable.
- Keep API-Football as a fallback provider when access is restored and the mapped fixture IDs are useful.
- Sync fixtures/results/status on a schedule.
- Track sync logs and failures.
- Do not block app usage if API sync fails.

## 9. UX Requirements

- The first home screen section must prioritize upcoming lock deadlines.
- If a returning player has a room session, home must show "Your rooms" before generic join/create sections.
- The room page should act as a room hub for returning members: current/live fixtures first, then room score, then result history.
- Match cards should be compact, score-forward, and readable on phone.
- Home room shortcuts should look and behave like obvious clickable actions.
- Prediction controls should be thumb-friendly.
- Saved prediction summaries should reduce cognitive load: final score first, supporting details as short pills or compact text.
- Server-action buttons must show immediate pending states such as "Creating room...", "Joining room...", and "Saving predictions..." so taps feel responsive.
- Leaderboard and room member rows should always include avatar + name.
- Use clear states for open, locked, live, final, pending API data, and scored.
- Avoid dense table UI.

## 10. Technical Requirements

- Next.js app deployable on Vercel.
- Supabase Postgres as system of record.
- Environment variables for Supabase and football API credentials.
- Server-side routes/actions for write operations and protected scoring/sync work.
- Basic seed scripts for tournament fixtures and teams.
- Tests for scoring, locking, room join, prediction submission, and leaderboard calculation.

## 11. Design Decisions

### Room Code + Display Name Instead Of Auth

Decision: use invite code + display name with local session restore.

Reason: the target group is small and casual. Email/password would add friction, and a PIN felt like security theater for a no-money friend game. The browser session is enough for same-device continuity.

Trade-off: weaker identity assurance than real auth. Acceptable for a friend-room game with no money involved. If cross-device recovery becomes important later, add a proper lightweight recovery flow instead of reintroducing a visible PIN.

### Seeded Fixtures Plus API Sync

Decision: seed fixtures upfront and use API sync for status/results.

Reason: fixtures are known and should not depend on an external API at render time. API sync adds automation without making the app fragile.

Trade-off: seed data must be maintained if schedules change. API sync can update fixture status and results later.

### Provider Abstraction For Football Data

Decision: treat ESPN and API-Football as interchangeable providers behind a local sync interface.

Reason: API-Football access can be unavailable, suspended, rate-limited, or missing event detail. ESPN currently gives a no-key path for many scoreboard and detail checks. The app should keep working from local fixtures while trying the best available provider for live enrichment.

Trade-off: provider matching needs defensive code because local fixture IDs, API-Football IDs, and ESPN event IDs do not always match directly.

### One Prediction Per Player Per Match

Decision: predictions are global to a player/match, not room-specific.

Reason: it prevents double-counting in the global leaderboard when a player joins multiple rooms.

Trade-off: a player cannot make different predictions for the same match in different rooms in MVP. That is acceptable for simplicity.

### Score Breakdown On Prediction Row

Decision: store score columns directly on `predictions`.

Reason: it keeps the MVP model simple and easy to query.

Trade-off: adding many future markets may eventually need a separate market/score table. Do not introduce that until prediction markets become user-configurable.

### Simple Generated Avatars First

Decision: use initials, color, and badge choice in MVP.

Reason: avatars make the app social without needing storage, upload validation, or moderation.

Trade-off: less personal than photos. Photo upload can use Supabase Storage later.

## 12. Open Implementation Checks

- Restore or replace API-Football access if ESPN coverage becomes insufficient.
- Add durable provider team/event mapping where first/last scorer data is important.
- Confirm Vercel scheduled job limits for the selected sync cadence.
- Confirm Supabase free-tier capacity for expected room/player volume.
