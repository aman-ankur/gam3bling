import type {
  MatchResultForScoring,
  PendingMarket,
  PredictionForScoring,
  ScoreBreakdown
} from "./types";

const ZERO_SCORE: ScoreBreakdown = {
  scoreFinal: 0,
  scoreResult: 0,
  scoreHalftime: 0,
  scoreFirstScorer: 0,
  scoreLastScorer: 0,
  scoreTotal: 0,
  pendingMarkets: []
};

export function scorePrediction(
  prediction: PredictionForScoring,
  matchResult: MatchResultForScoring
): ScoreBreakdown {
  if (matchResult.homeScore == null || matchResult.awayScore == null) {
    return {
      ...ZERO_SCORE,
      pendingMarkets: ["finalScore"]
    };
  }

  const pendingMarkets: PendingMarket[] = [];
  const scoreFinal =
    prediction.finalHomeScore === matchResult.homeScore &&
    prediction.finalAwayScore === matchResult.awayScore
      ? 10
      : 0;
  const scoreResult = prediction.matchResult === matchResult.winner ? 5 : 0;
  const scoreHalftime = scoreHalftimeMarket(prediction, matchResult, pendingMarkets);
  const scoreFirstScorer = scoreTeamMarket(
    prediction.firstScoringTeamId,
    matchResult.firstScoringTeamId,
    "firstScorer",
    pendingMarkets
  );
  const scoreLastScorer = scoreTeamMarket(
    prediction.lastScoringTeamId,
    matchResult.lastScoringTeamId,
    "lastScorer",
    pendingMarkets
  );

  return {
    scoreFinal,
    scoreResult,
    scoreHalftime,
    scoreFirstScorer,
    scoreLastScorer,
    scoreTotal: scoreFinal + scoreResult + scoreHalftime + scoreFirstScorer + scoreLastScorer,
    pendingMarkets
  };
}

function scoreHalftimeMarket(
  prediction: PredictionForScoring,
  matchResult: MatchResultForScoring,
  pendingMarkets: PendingMarket[]
): number {
  if (matchResult.halftimeHomeScore == null || matchResult.halftimeAwayScore == null) {
    pendingMarkets.push("halftime");
    return 0;
  }

  return prediction.halftimeHomeScore === matchResult.halftimeHomeScore &&
    prediction.halftimeAwayScore === matchResult.halftimeAwayScore
    ? 6
    : 0;
}

function scoreTeamMarket(
  predictedTeamId: string | null | undefined,
  officialTeamId: string | null | undefined,
  pendingMarket: PendingMarket,
  pendingMarkets: PendingMarket[]
): number {
  if (officialTeamId == null) {
    pendingMarkets.push(pendingMarket);
    return 0;
  }

  return predictedTeamId === officialTeamId ? 4 : 0;
}
