export type MatchResult = "home" | "away" | "draw";

export type PendingMarket = "finalScore" | "halftime" | "firstScorer" | "lastScorer" | "penaltyScore";

export type PredictionForScoring = {
  finalHomeScore: number;
  finalAwayScore: number;
  matchResult: MatchResult;
  halftimeHomeScore: number;
  halftimeAwayScore: number;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  firstScoringTeamId?: string | null;
  lastScoringTeamId?: string | null;
};

export type MatchResultForScoring = {
  homeScore?: number | null;
  awayScore?: number | null;
  halftimeHomeScore?: number | null;
  halftimeAwayScore?: number | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
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
  scorePenalty: number;
  scoreTotal: number;
  pendingMarkets: PendingMarket[];
};
