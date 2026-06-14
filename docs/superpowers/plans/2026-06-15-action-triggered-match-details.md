# Action-Triggered Match Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API-backed match detail tabs with globally cached lineups and stats for prediction-eligible matches.

**Architecture:** Extend the existing API-Football provider with a match-details method, add match-scoped cache tables, and introduce a server-side cache service that runs only for open prediction matches and match-page fallback loads. The UI reads cached match details and presents Predictions, Lineups, and Stats tabs without exposing cache/debug states to users.

**Tech Stack:** Next.js 15 App Router, TypeScript, React, Supabase Postgres, API-Football, Vitest, Playwright, CSS in `app/globals.css`.

---

### Task 1: Match List Saved State Labels

**Files:**
- Modify: `components/match-card.tsx`
- Modify: `app/r/[slug]/matches/page.tsx`
- Modify: `features/predictions/data.ts`
- Test: `testing/e2e/phase4-matches-leaderboards.spec.ts`

- [ ] **Step 1: Write failing browser expectation**

Update the matches-page test so a saved match can show a non-debug, user-facing action label:

```ts
await expect(page.getByRole("link", { name: /Show prediction Netherlands vs Japan/i })).toBeVisible();
await expect(page.getByText("Details cached")).toHaveCount(0);
await expect(page.getByText("Fetch queued")).toHaveCount(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- testing/e2e/phase4-matches-leaderboards.spec.ts`

Expected: FAIL because match cards still render `Predict`.

- [ ] **Step 3: Implement saved labels**

Add `actionLabel` and `ariaActionLabel` props to `MatchCard`. Add a room-level prediction lookup that returns saved match IDs for the current player. In the matches page, pass `Show prediction` for saved open matches and `Predict` for unsaved open matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- testing/e2e/phase4-matches-leaderboards.spec.ts`

Expected: PASS.

### Task 2: Database Schema For Match Details

**Files:**
- Create: `db/migrations/0002_match_details.sql`
- Test: `db/match-details-schema.test.ts`

- [ ] **Step 1: Write schema test**

Create a test that reads `0002_match_details.sql` and asserts it defines `match_details`, `match_lineups`, `match_lineup_players`, and `match_team_statistics`, including unique constraints for `(match_id, team_id)` and `(match_id, team_id, stat_name)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test db/match-details-schema.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add migration**

Create SQL for the four match-scoped tables with check constraints for cache statuses and lineup player roles.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test db/match-details-schema.test.ts`

Expected: PASS.

### Task 3: Provider Match Details Normalization

**Files:**
- Modify: `features/sync/provider.ts`
- Modify: `features/sync/api-football-provider.ts`
- Test: `features/sync/provider.test.ts`

- [ ] **Step 1: Write provider tests**

Add tests for `normalizeApiFootballLineups`, `normalizeApiFootballStatistics`, and `createApiFootballProvider().fetchMatchDetails("123")`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test features/sync/provider.test.ts`

Expected: FAIL because match-detail provider types and methods do not exist.

- [ ] **Step 3: Implement provider support**

Add `ProviderMatchDetails`, `ProviderLineup`, `ProviderLineupPlayer`, and `ProviderTeamStatistic` types. Fetch `/fixtures/lineups?fixture=123` and `/fixtures/statistics?fixture=123`, normalize lineups/statistics, and treat empty provider responses as `unavailable`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test features/sync/provider.test.ts`

Expected: PASS.

### Task 4: Match Detail Cache Service

**Files:**
- Create: `features/match-details/types.ts`
- Create: `features/match-details/data.ts`
- Create: `features/match-details/cache.ts`
- Test: `features/match-details/cache.test.ts`

- [ ] **Step 1: Write cache service tests**

Cover: eligible matches with missing cache are fetched, fresh available cache is skipped, unavailable cache waits for cooldown, non-numeric API IDs are skipped, and stored lineups are upserted by match/team.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test features/match-details/cache.test.ts`

Expected: FAIL because the cache service does not exist.

- [ ] **Step 3: Implement cache service**

Implement `ensureMatchDetailsForMatches`, `getMatchDetails`, and provider-team mapping from local match home/away teams to provider team IDs returned in lineups/statistics.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test features/match-details/cache.test.ts`

Expected: PASS.

### Task 5: Match Page Tabs And Pitch UI

**Files:**
- Create: `components/match-detail-tabs.tsx`
- Create: `components/lineup-pitch.tsx`
- Modify: `app/r/[slug]/matches/[matchId]/page.tsx`
- Modify: `app/globals.css`
- Test: `testing/e2e/phase4-matches-leaderboards.spec.ts`

- [ ] **Step 1: Write browser tests**

Add expectations that the match page renders `Predictions`, `Lineups`, and `Stats` tabs; clicking `Lineups` shows either a pitch or `Lineups are not confirmed yet`; clicking `Stats` shows team comparison or unavailable state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- testing/e2e/phase4-matches-leaderboards.spec.ts`

Expected: FAIL because tabs are not implemented.

- [ ] **Step 3: Implement tabs**

Move existing receipt, friends' predictions, and edit form into the `Predictions` panel. Add `Lineups` and `Stats` panels fed by cached `MatchDetailsView`. Use CSS-only radio tabs so no new client state is required.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- testing/e2e/phase4-matches-leaderboards.spec.ts`

Expected: PASS.

### Task 6: Full Verification And Production Readiness

**Files:**
- Modify docs or mockup only if implementation behavior differs from the approved flow.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 4: Run browser tests**

Run: `npm run test:e2e`

Expected: exit 0.

- [ ] **Step 5: Review git diff**

Run: `git status --short` and `git diff --stat`

Expected: only intended match-details feature files, mockup, spec, and plan are changed.
