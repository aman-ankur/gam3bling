import { describe, expect, test } from "vitest";
import { getMatchClockLabel, shouldShowMatchClock } from "./live-clock";

describe("live match clock", () => {
  test("formats elapsed live match time with seconds", () => {
    expect(
      getMatchClockLabel({
        kickoffAt: "2026-06-15T15:00:00.000Z",
        now: new Date("2026-06-15T16:11:24.000Z"),
        status: "live"
      })
    ).toBe("71:24");
  });

  test("uses fixed labels for halftime and final states", () => {
    expect(
      getMatchClockLabel({
        kickoffAt: "2026-06-15T15:00:00.000Z",
        now: new Date("2026-06-15T16:11:24.000Z"),
        status: "halftime"
      })
    ).toBe("HT");
    expect(
      getMatchClockLabel({
        kickoffAt: "2026-06-15T15:00:00.000Z",
        now: new Date("2026-06-15T17:00:00.000Z"),
        status: "final"
      })
    ).toBe("FT");
  });

  test("only renders for active match states", () => {
    expect(shouldShowMatchClock("scheduled")).toBe(false);
    expect(shouldShowMatchClock("live")).toBe(true);
    expect(shouldShowMatchClock("halftime")).toBe(true);
    expect(shouldShowMatchClock("final")).toBe(true);
  });
});
