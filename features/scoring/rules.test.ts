import { expect, test } from "vitest";
import { MAX_PREDICTION_POINTS, SCORING_RULES, SCORING_SUMMARY } from "./rules";

test("keeps scoring rules in one concise source of truth", () => {
  expect(SCORING_RULES).toEqual([
    { label: "Exact score", points: 10 },
    { label: "Result", points: 5 },
    { label: "Half-time", points: 6 },
    { label: "First team to score", points: 4 },
    { label: "Last team to score", points: 4 },
    { label: "Penalty score", points: 7, detail: "Exact 7, one side 4, winner 3" }
  ]);
  expect(MAX_PREDICTION_POINTS).toBe(36);
  expect(SCORING_SUMMARY).toBe("Exact 10 · Result 5 · HT 6 · First/last 4 each · Pens exact 7, side 4, winner 3");
});
