import { expect, test } from "vitest";
import { getResultCheckState } from "./check-window";

const match = {
  kickoffAt: "2026-06-15T16:00:00.000Z",
  lastSyncedAt: null,
  status: "scheduled"
};

test("keeps result checking closed before the expected full-time window", () => {
  const state = getResultCheckState(match, new Date("2026-06-15T17:45:00.000Z"));

  expect(state).toEqual({
    canCheck: false,
    reason: "early",
    availableAt: "2026-06-15T17:55:00.000Z"
  });
});

test("opens result checking after expected full time", () => {
  const state = getResultCheckState(match, new Date("2026-06-15T17:56:00.000Z"));

  expect(state).toEqual({
    canCheck: true,
    reason: "available"
  });
});

test("keeps final matches from showing the manual check button", () => {
  const state = getResultCheckState(
    { ...match, status: "final" },
    new Date("2026-06-15T18:00:00.000Z")
  );

  expect(state).toEqual({
    canCheck: false,
    reason: "final"
  });
});

test("enforces a five-minute cooldown after a recent result check", () => {
  const state = getResultCheckState(
    { ...match, lastSyncedAt: "2026-06-15T17:58:00.000Z" },
    new Date("2026-06-15T18:00:00.000Z")
  );

  expect(state).toEqual({
    canCheck: false,
    reason: "cooldown",
    cooldownUntil: "2026-06-15T18:03:00.000Z"
  });
});

test("opens result checking after the five-minute cooldown expires", () => {
  const state = getResultCheckState(
    { ...match, lastSyncedAt: "2026-06-15T17:58:00.000Z" },
    new Date("2026-06-15T18:03:00.000Z")
  );

  expect(state).toEqual({
    canCheck: true,
    reason: "available"
  });
});
