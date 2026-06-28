import { expect, test } from "vitest";
import { validatePredictionFields } from "./validation";

const BASE_FIELDS = {
  finalAwayScore: 1,
  finalHomeScore: 1,
  firstScoringTeamId: "home",
  halftimeAwayScore: 0,
  halftimeHomeScore: 0,
  lastScoringTeamId: "away",
  matchAwayTeamId: "away",
  matchHomeTeamId: "home",
  matchResult: "draw",
  penaltyAwayScore: 4,
  penaltyHomeScore: 5
};

test("requires penalty scores for any draw prediction", () => {
  expect(validatePredictionFields({
    ...BASE_FIELDS,
    matchStage: "Group A",
    penaltyAwayScore: null,
    penaltyHomeScore: null
  })).toBe("missing_penalty_score");
});

test("accepts penalty scores for group-stage draw predictions", () => {
  expect(validatePredictionFields({
    ...BASE_FIELDS,
    matchStage: "Group A"
  })).toBeNull();
});

test("does not require penalty scores for non-draw predictions", () => {
  expect(validatePredictionFields({
    ...BASE_FIELDS,
    finalHomeScore: 2,
    matchResult: "home",
    penaltyAwayScore: null,
    penaltyHomeScore: null
  })).toBeNull();
});
