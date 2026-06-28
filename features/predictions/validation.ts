export type PredictionValidationFields = {
  finalAwayScore: number;
  finalHomeScore: number;
  firstScoringTeamId: string;
  halftimeAwayScore: number;
  halftimeHomeScore: number;
  lastScoringTeamId: string;
  matchAwayTeamId: string;
  matchHomeTeamId: string;
  matchResult: string;
  matchStage?: string;
  penaltyAwayScore: number | null;
  penaltyHomeScore: number | null;
};

export function validatePredictionFields({
  finalAwayScore,
  finalHomeScore,
  firstScoringTeamId,
  halftimeAwayScore,
  halftimeHomeScore,
  lastScoringTeamId,
  matchAwayTeamId,
  matchHomeTeamId,
  matchResult,
  penaltyAwayScore,
  penaltyHomeScore
}: PredictionValidationFields): string | null {
  const derivedResult = finalHomeScore > finalAwayScore ? "home" : finalAwayScore > finalHomeScore ? "away" : "draw";

  if (matchResult !== derivedResult) {
    return "result_mismatch";
  }

  if (halftimeHomeScore > finalHomeScore || halftimeAwayScore > finalAwayScore) {
    return "halftime_exceeds_final";
  }

  if (derivedResult === "draw" && (penaltyHomeScore == null || penaltyAwayScore == null)) {
    return "missing_penalty_score";
  }

  const scoringTeamIds = new Set<string>();

  if (finalHomeScore > 0) {
    scoringTeamIds.add(matchHomeTeamId);
  }

  if (finalAwayScore > 0) {
    scoringTeamIds.add(matchAwayTeamId);
  }

  if (scoringTeamIds.size === 0) {
    return firstScoringTeamId || lastScoringTeamId ? "scorer_without_goals" : null;
  }

  if (!firstScoringTeamId || !lastScoringTeamId) {
    return "missing_scorer";
  }

  if (!scoringTeamIds.has(firstScoringTeamId) || !scoringTeamIds.has(lastScoringTeamId)) {
    return "scorer_team_did_not_score";
  }

  return null;
}
