export type MatchResult = "home" | "away" | "draw";

export type PendingMarket = "finalScore" | "halftime" | "firstScorer" | "lastScorer";

export type PredictionForScoring = {
  finalHomeScore: number;
  finalAwayScore: number;
  matchResult: MatchResult;
  halftimeHomeScore: number;
  halftimeAwayScore: number;
  firstScoringTeamId?: string | null;
  lastScoringTeamId?: string | null;
};

export type MatchResultForScoring = {
  homeScore?: number | null;
  awayScore?: number | null;
  halftimeHomeScore?: number | null;
  halftimeAwayScore?: number | null;
  winner?: MatchResult | null;
  firstScoringTeamId?: string | null;
  lastScoringTeamId?: string | null;
};

export type ScoreBreakdown = {
  scoreFinal: number;
  scoreResult: number;
  scoreHalftime: number;
  scoreFirstScorer: number;
  scoreLastScorer: number;
  scoreTotal: number;
  pendingMarkets: PendingMarket[];
};
