import { expect, test } from "vitest";
import { scorePrediction } from "./score-prediction";

const BRAZIL_ID = "team-brazil";
const FRANCE_ID = "team-france";
const JAPAN_ID = "team-japan";

test("awards all points for an exact prediction", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 1,
      matchResult: "home",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: FRANCE_ID
    },
    {
      homeScore: 2,
      awayScore: 1,
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      winner: "home",
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: FRANCE_ID
    }
  );

  expect(score).toEqual({
    scoreFinal: 10,
    scoreResult: 5,
    scoreHalftime: 6,
    scoreFirstScorer: 4,
    scoreLastScorer: 4,
    scorePenalty: 0,
    scoreTotal: 29,
    pendingMarkets: []
  });
});

test("awards result points without exact final score points", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 3,
      finalAwayScore: 1,
      matchResult: "home",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0
    },
    {
      homeScore: 2,
      awayScore: 0,
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      winner: "home"
    }
  );

  expect(score.scoreFinal).toBe(0);
  expect(score.scoreResult).toBe(5);
  expect(score.scoreTotal).toBe(5);
});

test("awards halftime points independently", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 1,
      matchResult: "away",
      halftimeHomeScore: 1,
      halftimeAwayScore: 1
    },
    {
      homeScore: 4,
      awayScore: 0,
      halftimeHomeScore: 1,
      halftimeAwayScore: 1,
      winner: "home"
    }
  );

  expect(score.scoreHalftime).toBe(6);
  expect(score.scoreTotal).toBe(6);
});

test("awards first and last scorer points independently", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 0,
      finalAwayScore: 0,
      matchResult: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: JAPAN_ID
    },
    {
      homeScore: 2,
      awayScore: 1,
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      winner: "home",
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: JAPAN_ID
    }
  );

  expect(score.scoreFirstScorer).toBe(4);
  expect(score.scoreLastScorer).toBe(4);
  expect(score.scoreTotal).toBe(8);
});

test("awards seven penalty points for an exact shootout prediction", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 1,
      finalAwayScore: 1,
      matchResult: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    },
    {
      homeScore: 1,
      awayScore: 1,
      winner: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    }
  );

  expect(score.scorePenalty).toBe(7);
  expect(score.scoreTotal).toBe(28);
});

test("awards four penalty points when only one shootout side is correct", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 1,
      finalAwayScore: 1,
      matchResult: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 3
    },
    {
      homeScore: 1,
      awayScore: 1,
      winner: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    }
  );

  expect(score.scorePenalty).toBe(4);
  expect(score.scoreTotal).toBe(25);
});

test("awards three penalty points when only the shootout winner is correct", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 2,
      matchResult: "draw",
      halftimeHomeScore: 0,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    },
    {
      homeScore: 1,
      awayScore: 1,
      winner: "draw",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      penaltyHomeScore: 4,
      penaltyAwayScore: 3
    }
  );

  expect(score.scorePenalty).toBe(3);
  expect(score.scoreTotal).toBe(8);
});

test("does not stack partial penalty points on exact shootout predictions", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 2,
      matchResult: "draw",
      halftimeHomeScore: 1,
      halftimeAwayScore: 1,
      penaltyHomeScore: 4,
      penaltyAwayScore: 2
    },
    {
      homeScore: 2,
      awayScore: 2,
      winner: "draw",
      halftimeHomeScore: 1,
      halftimeAwayScore: 1,
      penaltyHomeScore: 4,
      penaltyAwayScore: 2
    }
  );

  expect(score.scorePenalty).toBe(7);
});

test("does not leave penalty score pending when the official match is not a draw", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 2,
      matchResult: "draw",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    },
    {
      homeScore: 2,
      awayScore: 1,
      winner: "home",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0
    }
  );

  expect(score.scorePenalty).toBe(0);
  expect(score.pendingMarkets).not.toContain("penaltyScore");
});

test("marks optional markets pending when official data is unavailable", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 1,
      matchResult: "home",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: FRANCE_ID
    },
    {
      homeScore: 2,
      awayScore: 1,
      winner: "home"
    }
  );

  expect(score.scoreTotal).toBe(15);
  expect(score.scoreHalftime).toBe(0);
  expect(score.scoreFirstScorer).toBe(0);
  expect(score.scoreLastScorer).toBe(0);
  expect(score.pendingMarkets).toEqual(["halftime", "firstScorer", "lastScorer"]);
});

test("does not score a match while final score is unavailable", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 2,
      finalAwayScore: 1,
      matchResult: "home",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: FRANCE_ID
    },
    {
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: FRANCE_ID
    }
  );

  expect(score).toEqual({
    scoreFinal: 0,
    scoreResult: 0,
    scoreHalftime: 0,
    scoreFirstScorer: 0,
    scoreLastScorer: 0,
    scorePenalty: 0,
    scoreTotal: 0,
    pendingMarkets: ["finalScore"]
  });
});

test("returns zero points for a fully incorrect prediction", () => {
  const score = scorePrediction(
    {
      finalHomeScore: 1,
      finalAwayScore: 2,
      matchResult: "away",
      halftimeHomeScore: 0,
      halftimeAwayScore: 1,
      firstScoringTeamId: FRANCE_ID,
      lastScoringTeamId: FRANCE_ID
    },
    {
      homeScore: 3,
      awayScore: 0,
      halftimeHomeScore: 2,
      halftimeAwayScore: 0,
      winner: "home",
      firstScoringTeamId: BRAZIL_ID,
      lastScoringTeamId: BRAZIL_ID
    }
  );

  expect(score).toEqual({
    scoreFinal: 0,
    scoreResult: 0,
    scoreHalftime: 0,
    scoreFirstScorer: 0,
    scoreLastScorer: 0,
    scorePenalty: 0,
    scoreTotal: 0,
    pendingMarkets: []
  });
});
