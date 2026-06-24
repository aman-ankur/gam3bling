import { expect, test } from "vitest";
import type { AppMatch } from "./data";
import { getActiveMatchIds, getOpenPredictionMatchIds, isMatchInOpenPredictionWindow } from "./prediction-window";

test("opens up to eight future scheduled matches from today and tomorrow in IST", () => {
  const now = new Date("2026-06-14T18:00:00.000Z"); // 14 Jun, 11:30 PM IST
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T17:30:00.000Z" }), // already past
    buildMatch(2, { kickoffAt: "2026-06-14T18:15:00.000Z" }), // today IST
    buildMatch(3, { kickoffAt: "2026-06-14T19:00:00.000Z" }), // tomorrow IST
    buildMatch(4, { kickoffAt: "2026-06-15T00:00:00.000Z" }),
    buildMatch(5, { kickoffAt: "2026-06-15T03:00:00.000Z" }),
    buildMatch(6, { kickoffAt: "2026-06-15T06:00:00.000Z" }),
    buildMatch(7, { kickoffAt: "2026-06-15T09:00:00.000Z" }),
    buildMatch(8, { kickoffAt: "2026-06-15T12:00:00.000Z" }),
    buildMatch(9, { kickoffAt: "2026-06-15T15:00:00.000Z" }),
    buildMatch(10, { kickoffAt: "2026-06-15T18:00:00.000Z" }),
    buildMatch(11, { kickoffAt: "2026-06-15T18:29:00.000Z" }), // still tomorrow IST, but over the 8-match cap
    buildMatch(12, { kickoffAt: "2026-06-15T18:30:00.000Z" }) // day after tomorrow IST
  ];

  const openMatchIds = getOpenPredictionMatchIds(matches, now);

  expect([...openMatchIds]).toEqual([
    "match-2",
    "api-2",
    "match-3",
    "api-3",
    "match-4",
    "api-4",
    "match-5",
    "api-5",
    "match-6",
    "api-6",
    "match-7",
    "api-7",
    "match-8",
    "api-8",
    "match-9",
    "api-9"
  ]);
  expect(isMatchInOpenPredictionWindow(matches[8], matches, now)).toBe(true);
  expect(isMatchInOpenPredictionWindow(matches[10], matches, now)).toBe(false);
  expect(isMatchInOpenPredictionWindow(matches[11], matches, now)).toBe(false);
});

test("does not open past or non-scheduled matches", () => {
  const now = new Date("2026-06-14T12:00:00.000Z");
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T11:00:00.000Z" }),
    buildMatch(2, { status: "final" }),
    buildMatch(3, { kickoffAt: "2026-06-14T15:00:00.000Z" })
  ];

  expect([...getOpenPredictionMatchIds(matches, now)]).toEqual(["match-3", "api-3"]);
});

test("does not fill the open window with matches after tomorrow in IST", () => {
  const now = new Date("2026-06-14T04:00:00.000Z"); // 14 Jun, 9:30 AM IST
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T08:00:00.000Z" }),
    buildMatch(2, { kickoffAt: "2026-06-15T18:29:00.000Z" }),
    buildMatch(3, { kickoffAt: "2026-06-15T18:30:00.000Z" })
  ];

  expect([...getOpenPredictionMatchIds(matches, now)]).toEqual(["match-1", "api-1", "match-2", "api-2"]);
});

test("keeps a just-started match active after predictions lock", () => {
  const now = new Date("2026-06-14T12:05:00.000Z");
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T12:00:00.000Z" }),
    buildMatch(2, { kickoffAt: "2026-06-14T15:00:00.000Z" })
  ];

  expect([...getOpenPredictionMatchIds(matches, now)]).toEqual(["match-2", "api-2"]);
  expect([...getActiveMatchIds(matches, now)]).toEqual(["match-1", "api-1"]);
});

test("drops final and stale unsynced matches from active matches", () => {
  const now = new Date("2026-06-14T15:00:00.000Z");
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T12:00:00.000Z" }),
    buildMatch(2, { kickoffAt: "2026-06-14T14:00:00.000Z", status: "final" }),
    buildMatch(3, { kickoffAt: "2026-06-14T13:00:00.000Z", status: "live" })
  ];

  expect([...getActiveMatchIds(matches, now)]).toEqual(["match-3", "api-3"]);
});

test("keeps live matches active only when recently synced or within the normal match window", () => {
  const now = new Date("2026-06-14T16:00:00.000Z");
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T12:00:00.000Z", status: "live" }),
    buildMatch(2, { kickoffAt: "2026-06-14T12:00:00.000Z", status: "live", lastSyncedAt: "2026-06-14T15:45:00.000Z" }),
    buildMatch(3, { kickoffAt: "2026-06-14T14:00:00.000Z", status: "live" })
  ];

  expect([...getActiveMatchIds(matches, now)]).toEqual(["match-2", "api-2", "match-3", "api-3"]);
});

function buildMatch(index: number, overrides: Partial<AppMatch> = {}): AppMatch {
  return {
    id: `match-${index}`,
    apiMatchId: `api-${index}`,
    homeTeam: { id: `home-${index}`, name: `Home ${index}`, shortCode: `H${index}` },
    awayTeam: { id: `away-${index}`, name: `Away ${index}`, shortCode: `A${index}` },
    kickoffAt: `2026-06-${14 + index}T12:00:00.000Z`,
    stage: "Group",
    status: "scheduled",
    ...overrides
  };
}
