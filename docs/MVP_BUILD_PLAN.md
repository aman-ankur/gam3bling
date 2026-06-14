# Game Bling MVP Build Plan

Update 2026-06-15: this build plan is historical. Current shipped behavior is
documented in `docs/SESSION_HANDOFF_2026-06-15.md`, `docs/PRD.md`,
`docs/TECHNICAL_SPEC.md`, and `docs/DEPLOYMENT.md`.

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Keep commits frequent and keep each phase runnable.

**Goal:** Build the first playable Game Bling MVP: a mobile-first World Cup prediction room app with lightweight player identity, seeded fixtures, prediction entry, scoring, and leaderboards.

**Architecture:** Next.js App Router provides UI, server routes, and future scheduled endpoints. Supabase Postgres is the system of record. Scoring and lock behavior live in pure TypeScript modules so they can be tested independently from React.

**Tech Stack:** Next.js, TypeScript, React, Supabase, Vitest, Playwright, Vercel.

---

## File Structure

Create or preserve these areas:

- `app/`: Next.js routes, app layout, and page shells.
- `components/`: shared UI components such as app chrome, match cards, avatars, and bottom nav.
- `features/scoring/`: pure scoring logic and tests.
- `features/predictions/`: prediction form models, lock helpers, and future actions.
- `features/rooms/`: room join/create models and future actions.
- `features/players/`: player profile/avatar models and future actions.
- `features/matches/`: match models and schedule helpers.
- `features/leaderboards/`: leaderboard calculation/query helpers.
- `features/sync/`: football data provider contract and API-Football adapter.
- `db/`: migrations, seed data, and Supabase helpers.
- `testing/`: browser flow tests and fixtures.
- `docs/`: product, technical, and implementation docs.
- `mockuup/`: locked static mockups, preserved as design reference.

## Phase 0: App Foundation

### Task 0.1: Scaffold Next.js Project Files

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `components/app-shell.tsx`
- Create: `components/bottom-nav.tsx`
- Create: `components/avatar.tsx`
- Create: `lib/config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [x] **Step 1: Add package scripts and dependencies**

```json
{
  "scripts": {
    "dev": "node scripts/ensure-port-free.mjs 3003 && next dev --hostname 127.0.0.1 --port 3003",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [x] **Step 2: Add app shell**

Create a mobile-first shell that renders a top identity area and bottom navigation, using the colors from the mockups.

- [x] **Step 3: Verify foundation**

Run: `npm install`

Expected: dependencies install successfully.

Run: `npm run build`

Expected: Next.js production build completes.

- [x] **Step 4: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs app components lib .env.example .gitignore
git commit -m "chore: scaffold Next.js app foundation"
```

### Task 0.2: Add Test Harness

**Files:**
- Create: `vitest.config.ts`
- Create: `testing/setup.ts`
- Create: `playwright.config.ts`
- Create: `testing/e2e/home.spec.ts`

- [x] **Step 1: Add a smoke test for the home page**

```ts
import { test, expect } from "@playwright/test";

test("home page renders the Gam3Bling shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Gam3Bling/i })).toBeVisible();
  await expect(page.getByText(/World Cup prediction rooms/i)).toBeVisible();
});
```

- [x] **Step 2: Run the smoke test**

Run: `npm run test:e2e`

Expected: the test passes after the app shell is available.

- [x] **Step 3: Commit**

Run:

```bash
git add vitest.config.ts playwright.config.ts testing
git commit -m "test: add initial app smoke test"
```

## Phase 1: Data Model And Seed Fixtures

### Task 1.1: Add Supabase Schema

**Files:**
- Create: `db/migrations/0001_initial_schema.sql`
- Create: `db/README.md`

- [x] **Step 1: Add migration**

Create tables from `docs/TECHNICAL_SPEC.md`: `tournaments`, `teams`, `matches`, `rooms`, `players`, `room_members`, `predictions`, and `sync_logs`.

- [x] **Step 2: Verify migration syntax**

Run: `npm run test`

Expected: SQL file exists and schema validation tests pass after Task 1.2.

- [x] **Step 3: Commit**

```bash
git add db
git commit -m "feat: add initial Supabase schema"
```

### Task 1.2: Add Seed Data Loader

**Files:**
- Create: `db/seeds/world-cup-sample.json`
- Create: `db/validate-seed.test.ts`
- Create: `features/matches/types.ts`

- [x] **Step 1: Write failing seed validation test**

```ts
import seed from "./seeds/world-cup-sample.json";

test("sample seed contains valid matches with kickoff times", () => {
  expect(seed.matches.length).toBeGreaterThan(0);
  for (const match of seed.matches) {
    expect(match.homeTeamCode).not.toBe(match.awayTeamCode);
    expect(Number.isNaN(Date.parse(match.kickoffAt))).toBe(false);
  }
});
```

- [x] **Step 2: Run test and confirm it fails before seed exists**

Run: `npm run test -- db/validate-seed.test.ts`

Expected: fails because seed file does not exist.

- [x] **Step 3: Add seed file and match types**

Add sample teams and fixtures that support development before real World Cup fixture import.

- [x] **Step 4: Run test and confirm it passes**

Run: `npm run test -- db/validate-seed.test.ts`

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add db features/matches
git commit -m "feat: add sample World Cup seed data"
```

## Phase 2: Room And Player Identity

### Task 2.1: Add Player Identity Utilities

**Files:**
- Create: `features/players/identity.ts`
- Create: `features/players/identity.test.ts`

- [x] **Step 1: Write failing tests**

```ts
import { initialsFromName, normalizeDisplayName } from "./identity";

test("normalizes display names", () => {
  expect(normalizeDisplayName("  Aankur   Sharma ")).toBe("Aankur Sharma");
});

test("creates initials from display name", () => {
  expect(initialsFromName("Aankur Sharma")).toBe("AS");
  expect(initialsFromName("Rhea")).toBe("R");
});
```

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- features/players/identity.test.ts`

Expected: fails because functions are missing.

- [x] **Step 3: Implement utilities**

Implement `normalizeDisplayName` and `initialsFromName`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- features/players/identity.test.ts`

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add features/players
git commit -m "feat: add player identity helpers"
```

### Task 2.2: Add Room Code Utilities

**Files:**
- Create: `features/rooms/codes.ts`
- Create: `features/rooms/codes.test.ts`

- [x] **Step 1: Write failing tests**

```ts
import { normalizeInviteCode, isValidInviteCode } from "./codes";

test("normalizes invite codes", () => {
  expect(normalizeInviteCode(" tiger7 ")).toBe("TIGER7");
});

test("validates short invite codes", () => {
  expect(isValidInviteCode("TIGER7")).toBe(true);
  expect(isValidInviteCode("NO")).toBe(false);
  expect(isValidInviteCode("TOO-LONG-CODE")).toBe(false);
});
```

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- features/rooms/codes.test.ts`

Expected: fails because functions are missing.

- [x] **Step 3: Implement room code helpers**

Implement normalization and validation.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- features/rooms/codes.test.ts`

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add features/rooms
git commit -m "feat: add room invite code helpers"
```

## Phase 3: Prediction Locking And Scoring

### Task 3.1: Add Prediction Lock Helper

**Files:**
- Create: `features/predictions/locking.ts`
- Create: `features/predictions/locking.test.ts`

- [x] **Step 1: Write failing tests**

```ts
import { isPredictionLocked } from "./locking";

test("prediction is open before kickoff", () => {
  expect(isPredictionLocked({
    now: new Date("2026-06-14T11:00:00Z"),
    kickoffAt: new Date("2026-06-14T12:00:00Z")
  })).toBe(false);
});

test("prediction locks at kickoff", () => {
  expect(isPredictionLocked({
    now: new Date("2026-06-14T12:00:00Z"),
    kickoffAt: new Date("2026-06-14T12:00:00Z")
  })).toBe(true);
});
```

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- features/predictions/locking.test.ts`

Expected: fails because function is missing.

- [x] **Step 3: Implement lock helper**

Return true when `now >= kickoffAt`.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- features/predictions/locking.test.ts`

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add features/predictions
git commit -m "feat: add prediction locking helper"
```

### Task 3.2: Add Scoring Engine

**Files:**
- Create: `features/scoring/types.ts`
- Create: `features/scoring/score-prediction.ts`
- Create: `features/scoring/score-prediction.test.ts`

- [x] **Step 1: Write failing scoring tests**

Cover exact final score, result-only, half-time score, first scorer, last scorer, pending scorer markets, and zero-point cases.

- [x] **Step 2: Verify tests fail**

Run: `npm run test -- features/scoring/score-prediction.test.ts`

Expected: fails because scoring function is missing.

- [x] **Step 3: Implement minimal scoring engine**

Implement `scorePrediction(prediction, matchResult)` returning score breakdown and pending markets.

- [x] **Step 4: Verify tests pass**

Run: `npm run test -- features/scoring/score-prediction.test.ts`

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add features/scoring
git commit -m "feat: add prediction scoring engine"
```

## Phase 4: MVP Screens

### Task 4.1: Build Join And Room Screens

**Files:**
- Create: `app/r/[slug]/page.tsx`
- Create: `app/new/page.tsx`
- Create: `components/room-invite-card.tsx`
- Create: `components/member-list.tsx`

Acceptance criteria:

- [x] Room join view matches the mockup direction.
- [x] Room page shows short link, invite code, and members.
- [x] Forms are UI-only until server actions are wired.

### Task 4.2: Build Home And Prediction Screens

**Files:**
- Create: `app/r/[slug]/matches/page.tsx`
- Create: `app/r/[slug]/matches/[matchId]/page.tsx`
- Create: `components/match-card.tsx`
- Create: `components/prediction-form.tsx`
- Create: `components/prediction-receipt.tsx`

Acceptance criteria:

- [x] Home prioritizes upcoming lock deadlines.
- [x] Prediction screen includes all five MVP markets.
- [x] Locked/read-only visual state exists.

### Task 4.3: Build Leaderboards

**Files:**
- Create: `app/r/[slug]/leaderboard/page.tsx`
- Create: `app/leaderboard/page.tsx`
- Create: `components/leaderboard-list.tsx`

Acceptance criteria:

- [x] Room and global leaderboard screens exist.
- [x] Rows show rank, avatar, name, score, and secondary stat.

## Phase 5: API Sync And Deployment

### Task 5.1: Add Provider Contract

**Files:**
- Create: `features/sync/provider.ts`
- Create: `features/sync/api-football-provider.ts`
- Create: `features/sync/provider.test.ts`

Acceptance criteria:

- [x] Provider returns normalized match updates.
- [x] Missing optional event data does not throw.

### Task 5.2: Add Protected Sync Route

**Files:**
- Create: `app/api/sync/football/route.ts`
- Create: `features/sync/sync-matches.ts`
- Created for deployable MVP scoring recovery: `app/api/scoring/recalculate/route.ts`

Acceptance criteria:

- [x] Route checks `SYNC_JOB_SECRET`.
- [x] Sync failures write logs.
- [x] Final match updates can trigger scoring.

Current deployable MVP note: prediction entry and leaderboard reads are wired against Supabase-backed rooms, players, fixtures, memberships, and predictions. `/api/sync/football` now pulls API-FOOTBALL fixture updates for rows with numeric provider fixture IDs, writes `sync_logs`, updates final result fields, and recalculates prediction scores for final matches. Seed-style fixture IDs still support local prediction entry and are skipped by the provider adapter until real fixture IDs are attached.

### Task 5.3: Deploy

Acceptance criteria:

- Vercel project configured.
- Supabase project configured.
- Environment variables documented and set.
- One full deployed prediction/scoring path verified.
