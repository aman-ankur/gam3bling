import type { AppMatch } from "@/features/matches/data";
import type { FootballProvider } from "@/features/sync/provider";
import type { EnsureMatchDetailsResult, MatchDetailsCacheStore } from "./types";

const UNAVAILABLE_RETRY_MS = 30 * 60 * 1000;
const AVAILABLE_BEFORE_KICKOFF_FRESH_MS = 24 * 60 * 60 * 1000;
const AVAILABLE_AFTER_KICKOFF_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export async function ensureMatchDetailsForMatches({
  force = false,
  matches,
  provider,
  store,
  now = () => new Date()
}: {
  force?: boolean;
  matches: AppMatch[];
  provider: FootballProvider;
  store: MatchDetailsCacheStore;
  now?: () => Date;
}): Promise<EnsureMatchDetailsResult> {
  const fetchedAt = now();
  const result: EnsureMatchDetailsResult = {
    failureMessages: [],
    fetched: 0,
    saved: 0,
    skippedFresh: 0,
    skippedInvalidApiId: 0,
    failed: 0
  };

  for (const match of matches) {
    if (!match.apiMatchId) {
      result.skippedInvalidApiId += 1;
      continue;
    }

    const cache = await store.getCache(match.id);

    if (!force && cache && isFreshEnough(cache.lastFetchedAt, cache.status, match.kickoffAt, fetchedAt)) {
      result.skippedFresh += 1;
      continue;
    }

    result.fetched += 1;

    try {
      console.info("[match-details.cache] fetch_start", {
        apiMatchId: match.apiMatchId,
        apiProvider: match.apiProvider ?? null,
        kickoffAt: match.kickoffAt,
        matchId: match.id,
        provider: provider.name
      });
      const details = await provider.fetchMatchDetails({
        localMatchId: match.id,
        apiProvider: match.apiProvider ?? null,
        apiMatchId: match.apiMatchId,
        kickoffAt: match.kickoffAt,
        homeTeam: {
          id: match.homeTeam.id,
          name: match.homeTeam.name,
          shortCode: match.homeTeam.shortCode
        },
        awayTeam: {
          id: match.awayTeam.id,
          name: match.awayTeam.name,
          shortCode: match.awayTeam.shortCode
        }
      });
      console.info("[match-details.cache] fetch_success", {
        apiMatchId: match.apiMatchId,
        matchId: match.id,
        provider: provider.name,
        resolvedApiMatchId: details.apiMatchId,
        lineupsStatus: details.lineupsStatus,
        lineups: details.lineups.length,
        lineupPlayers: countLineupPlayers(details),
        statisticsStatus: details.statisticsStatus,
        statistics: details.statistics.length
      });
      await store.saveDetails({
        matchId: match.id,
        provider: provider.name,
        fetchedAt: fetchedAt.toISOString(),
        homeTeamId: match.homeTeam.id,
        homeTeamName: match.homeTeam.name,
        awayTeamId: match.awayTeam.id,
        awayTeamName: match.awayTeam.name,
        details
      });
      result.saved += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown match details fetch error";
      console.error("[match-details.cache] fetch_failed", {
        apiMatchId: match.apiMatchId,
        matchId: match.id,
        message: errorMessage
      });
      await store.recordFailure({
        matchId: match.id,
        provider: provider.name,
        fetchedAt: fetchedAt.toISOString(),
        errorMessage
      });
      result.failureMessages.push(errorMessage);
      result.failed += 1;
    }
  }

  return result;
}

function countLineupPlayers(details: { lineups: Array<{ players: unknown[] }> }): number {
  return details.lineups.reduce((total, lineup) => total + lineup.players.length, 0);
}

function isFreshEnough(
  lastFetchedAt: string | null,
  status: string,
  kickoffAt: string,
  now: Date
): boolean {
  if (!lastFetchedAt) {
    return false;
  }

  const fetchedMs = new Date(lastFetchedAt).getTime();

  if (Number.isNaN(fetchedMs)) {
    return false;
  }

  const ageMs = now.getTime() - fetchedMs;

  if (status === "available") {
    const kickoffMs = new Date(kickoffAt).getTime();
    const freshnessMs = kickoffMs > now.getTime() ? AVAILABLE_BEFORE_KICKOFF_FRESH_MS : AVAILABLE_AFTER_KICKOFF_FRESH_MS;

    return ageMs < freshnessMs;
  }

  return ageMs < UNAVAILABLE_RETRY_MS;
}
