import type { MatchResult, MatchStatus } from "../matches/types";

export type ProviderMatchUpdate = {
  apiMatchId: string;
  status: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHalftimeScore?: number | null;
  awayHalftimeScore?: number | null;
  winner?: MatchResult | null;
  firstScoringTeamExternalId?: string | null;
  lastScoringTeamExternalId?: string | null;
  kickoffAt?: string;
};

export type FootballProvider = {
  name: string;
  fetchUpdates(apiMatchIds: string[]): Promise<ProviderMatchUpdate[]>;
};
