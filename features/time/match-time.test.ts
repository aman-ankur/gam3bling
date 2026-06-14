import { expect, test } from "vitest";
import { formatKickoffInIst, formatTimeToKickoff } from "./match-time";

test("formats kickoff time in IST", () => {
  expect(formatKickoffInIst("2026-06-14T17:00:00Z")).toBe("14 Jun, 10:30 PM IST");
});

test("formats hours and minutes to kickoff", () => {
  expect(
    formatTimeToKickoff({
      now: new Date("2026-06-14T12:15:00Z"),
      kickoffAt: new Date("2026-06-14T17:00:00Z")
    })
  ).toBe("4h 45m to go");
});

test("marks elapsed kickoff as locked", () => {
  expect(
    formatTimeToKickoff({
      now: new Date("2026-06-14T17:00:00Z"),
      kickoffAt: new Date("2026-06-14T17:00:00Z")
    })
  ).toBe("Locked");
});
