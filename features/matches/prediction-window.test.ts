import { expect, test } from "vitest";
import type { AppMatch } from "./data";
import { getOpenPredictionMatchIds, isMatchInOpenPredictionWindow } from "./prediction-window";

test("opens only the next four future scheduled matches", () => {
  const now = new Date("2026-06-14T12:00:00.000Z");
  const matches = Array.from({ length: 6 }, (_, index) => buildMatch(index + 1));

  const openMatchIds = getOpenPredictionMatchIds(matches, now);

  expect([...openMatchIds]).toEqual([
    "match-1",
    "api-1",
    "match-2",
    "api-2",
    "match-3",
    "api-3",
    "match-4",
    "api-4"
  ]);
  expect(isMatchInOpenPredictionWindow(matches[3], matches, now)).toBe(true);
  expect(isMatchInOpenPredictionWindow(matches[4], matches, now)).toBe(false);
});

test("does not open past or non-scheduled matches", () => {
  const now = new Date("2026-06-14T12:00:00.000Z");
  const matches = [
    buildMatch(1, { kickoffAt: "2026-06-14T11:00:00.000Z" }),
    buildMatch(2, { status: "final" }),
    buildMatch(3)
  ];

  expect([...getOpenPredictionMatchIds(matches, now)]).toEqual(["match-3", "api-3"]);
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
