import seed from "./seeds/world-cup-sample.json";
import { expect, test } from "vitest";

test("sample seed contains valid matches with kickoff times", () => {
  expect(seed.matches.length).toBeGreaterThan(0);

  for (const match of seed.matches) {
    expect(match.homeTeamCode).not.toBe(match.awayTeamCode);
    expect(Number.isNaN(Date.parse(match.kickoffAt))).toBe(false);
  }
});
