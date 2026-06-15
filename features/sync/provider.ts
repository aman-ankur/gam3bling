import type { MatchResult, MatchStatus } from "../matches/types";

export type ProviderMatchUpdate = {
  apiMatchId: string;
  status: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeamExternalId?: string | null;
  awayTeamExternalId?: string | null;
  homeHalftimeScore?: number | null;
  awayHalftimeScore?: number | null;
  winner?: MatchResult | null;
  firstScoringTeamId?: string | null;
  lastScoringTeamId?: string | null;
  firstScoringTeamExternalId?: string | null;
  lastScoringTeamExternalId?: string | null;
  kickoffAt?: string;
};

export type ProviderAvailabilityStatus = "available" | "unavailable";

export type ProviderLineupPlayer = {
  providerPlayerId: string | null;
  playerName: string;
  shirtNumber: number | null;
  position: string | null;
  grid: string | null;
  role: "starter" | "substitute";
  sortOrder: number;
};

export type ProviderLineup = {
  providerTeamId: string;
  teamName: string;
  formation: string | null;
  coachName: string | null;
  players: ProviderLineupPlayer[];
};

export type ProviderTeamStatistic = {
  providerTeamId: string;
  teamName: string;
  statName: string;
  statValue: string | null;
  sortOrder: number;
};

export type ProviderMatchDetails = {
  apiMatchId: string;
  lineupsStatus: ProviderAvailabilityStatus;
  statisticsStatus: ProviderAvailabilityStatus;
  lineups: ProviderLineup[];
  statistics: ProviderTeamStatistic[];
  rawPayload: {
    lineups: unknown[];
    statistics: unknown[];
  };
};

export type FootballProvider = {
  name: string;
  fetchUpdates(apiMatchIds: string[]): Promise<ProviderMatchUpdate[]>;
  fetchMatchDetails(apiMatchId: string): Promise<ProviderMatchDetails>;
};
