import type {
  MatchResultForScoring,
  PendingMarket,
  PredictionForScoring,
  ScoreBreakdown
} from "./types";
import { SCORING_RULES } from "./rules";

const [FINAL_SCORE_RULE, RESULT_RULE, HALFTIME_RULE, FIRST_SCORER_RULE, LAST_SCORER_RULE] = SCORING_RULES;

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
      ? FINAL_SCORE_RULE.points
      : 0;
  const scoreResult = prediction.matchResult === matchResult.winner ? RESULT_RULE.points : 0;
  const scoreHalftime = scoreHalftimeMarket(prediction, matchResult, pendingMarkets);
  const scoreFirstScorer = scoreTeamMarket(
    prediction.firstScoringTeamId,
    matchResult.firstScoringTeamId,
    "firstScorer",
    pendingMarkets,
    FIRST_SCORER_RULE.points
  );
  const scoreLastScorer = scoreTeamMarket(
    prediction.lastScoringTeamId,
    matchResult.lastScoringTeamId,
    "lastScorer",
    pendingMarkets,
    LAST_SCORER_RULE.points
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
    ? HALFTIME_RULE.points
    : 0;
}

function scoreTeamMarket(
  predictedTeamId: string | null | undefined,
  officialTeamId: string | null | undefined,
  pendingMarket: PendingMarket,
  pendingMarkets: PendingMarket[],
  points: number
): number {
  if (officialTeamId == null) {
    pendingMarkets.push(pendingMarket);
    return 0;
  }

  return predictedTeamId === officialTeamId ? points : 0;
}
