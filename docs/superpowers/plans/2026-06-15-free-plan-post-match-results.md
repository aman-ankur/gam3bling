# Free-Plan Post-Match Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build free-plan compatible post-match result checking, scoring, and result UI for room hub and match pages.

**Architecture:** Keep cron-ready sync code, but make the free-plan path user-triggered. A server action checks whether a match is likely finished, enforces a 5-minute cooldown using `matches.last_synced_at`, syncs that one provider fixture, scores predictions when final, then redirects back to the match page. Room and match pages read scored rows and render post-match payoff and per-market breakdown.

**Tech Stack:** Next.js App Router, React server actions, Supabase admin client, API-FOOTBALL provider, Vitest, Playwright.

---

### Task 1: Result Check Timing

**Files:**
- Create: `features/results/check-window.ts`
- Test: `features/results/check-window.test.ts`

- [ ] Add tests for expected result-check availability:
  - before kickoff plus 115 minutes, checking is closed
  - after kickoff plus 115 minutes, checking is open
  - final matches are not checkable
  - recent `last_synced_at` creates a 5-minute cooldown
- [ ] Implement `getResultCheckState(match, now)` returning `{ canCheck, reason, availableAt, cooldownUntil }`.

### Task 2: Single-Match Sync

**Files:**
- Modify: `features/sync/sync-matches.ts`
- Test: `features/sync/sync-matches.test.ts`

- [ ] Add a test that `syncMatchResult` fetches one match, updates result fields, and scores predictions when final.
- [ ] Add a test that a non-final provider response updates status and `last_synced_at` without scoring predictions.
- [ ] Export a focused `syncMatchResult` helper and reuse the existing update/scoring helpers.

### Task 3: Manual Result Check Action

**Files:**
- Create: `features/results/actions.ts`
- Test: `features/results/actions.test.ts`

- [ ] Add tests for redirecting when too early, cooling down, missing match, and successful final sync.
- [ ] Implement `checkMatchResult(roomSlug, matchRouteId)` as a server action.
- [ ] Use the existing room route and redirect query params: `result=checked`, `result=pending`, `result=cooldown`, `result=early`, `result=error`.

### Task 4: Result Data For UI

**Files:**
- Create: `features/results/data.ts`
- Test: `features/results/data.test.ts`

- [ ] Add a query for latest completed room match with per-player score deltas.
- [ ] Add a query for match result breakdown including per-market scores.
- [ ] Keep fallback behavior empty unless `E2E_USE_FALLBACK_FIXTURES=1`.

### Task 5: UI Components

**Files:**
- Create: `components/latest-result-card.tsx`
- Create: `components/match-result-breakdown.tsx`
- Modify: `app/r/[slug]/page.tsx`
- Modify: `app/r/[slug]/matches/[matchId]/page.tsx`
- Modify: `app/globals.css`

- [ ] Replace the room history placeholder with Option A-style latest result card when a completed match exists.
- [ ] Render Option B-style match breakdown when the match has a final score and current player prediction.
- [ ] Render the `Check final result` button when check state allows it.
- [ ] Render closed/cooldown/pending messages for result check states.

### Task 6: Verification

**Files:**
- Test: affected unit tests
- Test: e2e suite if local server is available

- [ ] Run focused Vitest files for results/sync/leaderboard/predictions.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e` if the app can run on `127.0.0.1:3003`.
