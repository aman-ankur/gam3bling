# Game Bling Implementation Plan

Update 2026-06-15: this plan is historical. The shipped MVP differs in a few
important ways: users join with room code + display name, not a visible PIN;
home shows current room shortcuts; `/r/[slug]` is a room hub for returning
players; saved predictions collapse into a compact receipt with an expandable
edit form; and submit buttons use pending states. Use
`docs/SESSION_HANDOFF_2026-06-15.md`, `docs/PRD.md`, and
`docs/TECHNICAL_SPEC.md` as current references.

Date: 2026-06-14
Status: Ready for phased implementation

## Current Status

Phase 0 is complete as of commit `6af185c chore: scaffold Next.js app foundation`.

Completed:

- Next.js 15 + TypeScript app scaffold.
- Mobile-first `Gam3Bling` home shell.
- Shared `AppShell`, `Avatar`, and bottom nav components.
- ESLint, Vitest, and Playwright setup.
- Supabase/environment variable placeholders in `.env.example`.
- Phase 0 checklist marked complete in `docs/MVP_BUILD_PLAN.md`.

Verified:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

Next phase: Phase 1, database schema and seeded fixtures.

Local development rule: always run the app on `http://127.0.0.1:3003`. The `npm run dev` script frees port `3003` first, then starts Next.js on that exact port. If another process is using `3003`, stop that process rather than switching ports.

## Implementation Strategy

Build the app in small playable phases. Each phase should leave the repo in a working state and should avoid taking dependencies on future phases.

The implementation should start with the room/prediction/scoring loop using seeded data. API automation comes after the core loop is proven.

## Recommended Stack

- **App framework:** Next.js with App Router.
- **Language:** TypeScript.
- **Styling:** Tailwind CSS or CSS modules with design tokens; choose the lighter option during scaffolding.
- **Database:** Supabase Postgres.
- **Deployment:** Vercel.
- **Data provider:** API-Football behind a provider adapter.
- **Testing:** Vitest for unit tests, Playwright for core mobile flows.

## Architecture Overview

Suggested app boundaries:

- `app/`: routes and layouts.
- `components/`: UI components.
- `features/rooms/`: room creation, invite, membership.
- `features/players/`: name + PIN identity and avatar profile.
- `features/matches/`: schedule, match detail, status presentation.
- `features/predictions/`: prediction form, receipt, lock state.
- `features/leaderboards/`: room and global ranking queries.
- `features/scoring/`: pure scoring rules and scoring service.
- `features/sync/`: provider interface, API-Football adapter, sync jobs.
- `db/`: Supabase migrations, seed scripts, typed queries.
- `testing/`: Playwright scenarios and fixtures.

Keep scoring and lock logic independent from React components so they can be unit tested.

## Phase 0: Repo And Tooling Foundation

Goal: turn the mockup/design repo into a real app repo while preserving docs and mockups.

Deliverables:

- Next.js TypeScript app scaffold.
- Basic lint/test setup.
- App shell with mobile-first layout.
- Design tokens derived from the locked mockups.
- Supabase client setup with documented environment variable names.
- README setup instructions.

Acceptance criteria:

- App runs locally.
- Static home route renders.
- Mockup files remain available in `mockuup/`.
- Lint/test command exists, even if test coverage is small.

## Phase 1: Database Schema And Seeded Fixtures

Goal: create the simple permanent data model.

Deliverables:

- Supabase migration for:
  - `tournaments`
  - `teams`
  - `matches`
  - `rooms`
  - `players`
  - `room_members`
  - `predictions`
  - `sync_logs`
- Seed script for the initial tournament, teams, and sample fixtures.
- Typed data access helpers.
- Basic local seed fixture for development.

Acceptance criteria:

- A fresh database can be migrated and seeded.
- Matches can be queried as upcoming/live/finished.
- Schema supports all MVP prediction fields and score breakdown fields.

## Phase 2: Room Creation, Join, And Player Identity

Goal: make the app usable by a friend group.

Deliverables:

- Create room screen.
- Join room screen for slug + invite code.
- Player create/recover flow with display name + PIN.
- PIN hashing on server side.
- Local session persistence.
- Avatar initials/color/badge selection.
- Room page with invite link/code and member list.

Acceptance criteria:

- A user can create a room.
- A second user can join from the room link with the invite code.
- Returning on the same browser restores the player.
- Name + PIN can recover the player on a different browser/device.
- Room member list shows avatars and names.

## Phase 3: Match Home And Prediction Entry

Goal: make prediction submission fast and clear.

Deliverables:

- Home urgency feed:
  - next match needing prediction
  - lock countdown
  - missing prediction count
  - live/recent sections backed by seeded development data
- Match list page.
- Match detail/prediction screen.
- Prediction form for the five MVP markets.
- Prediction receipt after save.
- Edit until kickoff, read-only after kickoff.

Acceptance criteria:

- A player can see which match needs action next.
- A player can submit and edit predictions before kickoff.
- A player cannot edit after kickoff.
- Saved predictions reload correctly.
- Prediction entry works well on a phone viewport.

## Phase 4: Scoring And Leaderboards

Goal: close the game loop without live API dependency.

Deliverables:

- Pure scoring function for all markets.
- Scoring service that updates prediction score fields idempotently.
- Room leaderboard query.
- Global leaderboard query.
- Finished match result presentation.
- Recently scored movement feed using available score updates.

Acceptance criteria:

- Unit tests cover exact final score, match result, half-time score, first scorer, last scorer, pending scorer markets, and zero-point cases.
- Re-running scoring does not duplicate points.
- Room leaderboard ranks only room members.
- Global leaderboard counts each player's predictions once.
- Leaderboards update after match scoring.

## Phase 5: API Provider And Sync Automation

Goal: automate match status and results where data is available.

Deliverables:

- `FootballDataProvider` interface.
- `ApiFootballProvider` implementation.
- API credential environment variables.
- Sync job for upcoming/live/recent matches.
- Sync logs.
- Manual command or protected route to trigger sync during testing.
- Status UI for last sync and pending scorer data.

Acceptance criteria:

- API-Football coverage is verified for the relevant World Cup data.
- Sync can update match status, scores, half-time score, and scorer teams when available.
- API failure records a sync log and does not break the app.
- Scoring can run after synced final results.

## Phase 6: Polish, QA, And Vercel Deployment

Goal: make the MVP feel shippable for real friends.

Deliverables:

- Mobile UI pass against locked mockups.
- Empty/error/loading states.
- Basic accessibility pass for labels and buttons.
- Playwright checks for:
  - join flow
  - room flow
  - prediction flow
  - leaderboard flow
- Vercel deployment.
- Supabase production project configuration.
- Minimal operational notes in README.

Acceptance criteria:

- App is deployed on Vercel.
- A test room can be created and shared.
- At least one full match prediction/scoring path works on deployed environment.
- Mobile viewport has no major overflow or unreadable sections.

## Phase 7: Post-MVP Enhancements

Only start after the MVP is playable.

Candidate enhancements:

- Push reminders as PWA notifications.
- Admin/manual result correction screen.
- AI-generated match banter and room recaps.
- More prediction markets.
- Tournament-long predictions, such as champion or top scorer.
- Photo avatars via Supabase Storage.
- Multiple tournaments/sports UI.
- Confidence chip or streak bonus mechanics.

## Technical Decisions To Preserve

### Keep DB Model Simple

Use direct tables and score columns for MVP. Avoid a generic market engine until the product needs user-configurable markets.

### Treat API Data As Enhancement

Seed fixtures and lock predictions using local database time. API data updates status/results but does not control core availability.

### Keep Identity Lightweight

Name + PIN is enough for a friend-circle game. Do not add full auth unless the product expands into high-trust or public competition use cases.

### Keep Scoring Pure

Scoring rules should live in pure functions with explicit inputs and outputs. Database writes should happen in a separate service layer.

### Keep UI Mobile-First

Design for a 390px phone viewport first. Desktop can present the same cards with more breathing room, not a different information architecture.

## Risks And Mitigations

- **API quota or coverage limits:** seed fixtures and support pending scorer markets.
- **Ambiguous identity with duplicate names:** require PIN and room membership context; add display-name collision hints when duplicate-name recovery becomes a real usage problem.
- **Global leaderboard double-counting:** one prediction per player per match.
- **Schema overgrowth:** defer generic markets and uploads until needed.
- **Vercel scheduled job limits:** start with conservative sync cadence and manual trigger support.
