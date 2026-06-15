import type { ProviderMatchDetails } from "@/features/sync/provider";

export type MatchDetailCacheStatus = "missing" | "available" | "unavailable" | "failed";

export type MatchDetailCacheRecord = {
  status: MatchDetailCacheStatus;
  lineupsStatus: MatchDetailCacheStatus;
  statsStatus: MatchDetailCacheStatus;
  lastFetchedAt: string | null;
};

export type MatchDetailsSavePayload = {
  matchId: string;
  provider: string;
  fetchedAt: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  details: ProviderMatchDetails;
};

export type MatchDetailsFailurePayload = {
  matchId: string;
  provider: string;
  fetchedAt: string;
  errorMessage: string;
};

export type MatchDetailsCacheStore = {
  getCache(matchId: string): Promise<MatchDetailCacheRecord | null>;
  saveDetails(payload: MatchDetailsSavePayload): Promise<void>;
  recordFailure(payload: MatchDetailsFailurePayload): Promise<void>;
};

export type EnsureMatchDetailsResult = {
  failureMessages: string[];
  fetched: number;
  saved: number;
  skippedFresh: number;
  skippedInvalidApiId: number;
  failed: number;
};

export type MatchDetailsView = {
  lineupsStatus: MatchDetailCacheStatus;
  statsStatus: MatchDetailCacheStatus;
  lineups: MatchLineupView[];
  statistics: MatchTeamStatisticView[];
};

export type MatchLineupView = {
  id: string;
  teamId: string;
  teamName: string;
  formation: string | null;
  coachName: string | null;
  players: MatchLineupPlayerView[];
};

export type MatchLineupPlayerView = {
  playerName: string;
  shirtNumber: number | null;
  position: string | null;
  grid: string | null;
  role: "starter" | "substitute";
  sortOrder: number;
};

export type MatchTeamStatisticView = {
  teamId: string;
  teamName: string;
  statName: string;
  statValue: string | null;
  sortOrder: number;
};
