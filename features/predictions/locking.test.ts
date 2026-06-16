import { expect, test } from "vitest";
import { isPredictionLocked } from "./locking";

test("prediction is open before kickoff", () => {
  expect(
    isPredictionLocked({
      now: new Date("2026-06-14T11:00:00Z"),
      kickoffAt: new Date("2026-06-14T12:00:00Z")
    })
  ).toBe(false);
});

test("prediction locks at kickoff", () => {
  expect(
    isPredictionLocked({
      now: new Date("2026-06-14T12:00:00Z"),
      kickoffAt: new Date("2026-06-14T12:00:00Z")
    })
  ).toBe(true);
});

test("prediction locks when provider status says the match has started", () => {
  expect(
    isPredictionLocked({
      now: new Date("2026-06-14T11:00:00Z"),
      kickoffAt: new Date("2026-06-14T12:00:00Z"),
      status: "live"
    })
  ).toBe(true);
});
