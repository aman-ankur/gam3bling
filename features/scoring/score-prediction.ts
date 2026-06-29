import type {
  MatchResultForScoring,
  PendingMarket,
  PredictionForScoring,
  ScoreBreakdown
} from "./types";
import { SCORING_RULES } from "./rules";

const [FINAL_SCORE_RULE, RESULT_RULE, HALFTIME_RULE, FIRST_SCORER_RULE, LAST_SCORER_RULE, PENALTY_RULE] = SCORING_RULES;

const ZERO_SCORE: ScoreBreakdown = {
  scoreFinal: 0,
  scoreResult: 0,
  scoreHalftime: 0,
  scoreFirstScorer: 0,
  scoreLastScorer: 0,
  scorePenalty: 0,
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
  const scorePenalty = scorePenaltyMarket(prediction, matchResult, pendingMarkets);

  return {
    scoreFinal,
    scoreResult,
    scoreHalftime,
    scoreFirstScorer,
    scoreLastScorer,
    scorePenalty,
    scoreTotal: scoreFinal + scoreResult + scoreHalftime + scoreFirstScorer + scoreLastScorer + scorePenalty,
    pendingMarkets
  };
}

function scorePenaltyMarket(
  prediction: PredictionForScoring,
  matchResult: MatchResultForScoring,
  pendingMarkets: PendingMarket[]
): number {
  const predictedPenaltyHome = prediction.penaltyHomeScore;
  const predictedPenaltyAway = prediction.penaltyAwayScore;
  const officialPenaltyHome = matchResult.penaltyHomeScore;
  const officialPenaltyAway = matchResult.penaltyAwayScore;
  const hasPrediction = predictedPenaltyHome != null && predictedPenaltyAway != null;
  const needsPenaltyScore = matchResult.homeScore === matchResult.awayScore && matchResult.winner === "draw";

  if (!needsPenaltyScore) {
    return 0;
  }

  if (officialPenaltyHome == null || officialPenaltyAway == null) {
    pendingMarkets.push("penaltyScore");
    return 0;
  }

  if (!hasPrediction) {
    return 0;
  }

  const homeExact = predictedPenaltyHome === officialPenaltyHome;
  const awayExact = predictedPenaltyAway === officialPenaltyAway;

  if (homeExact && awayExact) {
    return PENALTY_RULE.points;
  }

  if (homeExact || awayExact) {
    return 4;
  }

  return samePenaltyWinner(
    predictedPenaltyHome,
    predictedPenaltyAway,
    officialPenaltyHome,
    officialPenaltyAway
  ) ? 3 : 0;
}

function samePenaltyWinner(
  predictedHome: number,
  predictedAway: number,
  officialHome: number,
  officialAway: number
): boolean {
  const predictedWinner = penaltyWinner(predictedHome, predictedAway);
  return predictedWinner != null && predictedWinner === penaltyWinner(officialHome, officialAway);
}

function penaltyWinner(homeScore: number, awayScore: number): "home" | "away" | null {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return null;
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
