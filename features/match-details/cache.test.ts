import { describe, expect, test, vi } from "vitest";
import { ensureMatchDetailsForMatches } from "./cache";
import type { MatchDetailsCacheStore } from "./types";
import type { AppMatch } from "../matches/data";
import type { FootballProvider, ProviderMatchDetails } from "../sync/provider";

describe("ensureMatchDetailsForMatches", () => {
  test("fetches and stores missing details for numeric API matches", async () => {
    const store = createStore();
    const provider = createProvider(providerDetails());

    await expect(ensureMatchDetailsForMatches({
      matches: [match()],
      provider,
      store,
      now: fixedNow
    })).resolves.toEqual({
      failureMessages: [],
      fetched: 1,
      saved: 1,
      skippedFresh: 0,
      skippedInvalidApiId: 0,
      failed: 0
    });

    expect(provider.fetchMatchDetails).toHaveBeenCalledWith("123");
    expect(store.saved[0]).toMatchObject({
      matchId: "match-1",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      details: {
        lineupsStatus: "available",
        statisticsStatus: "available"
      }
    });
  });

  test("skips fresh available cache", async () => {
    const store = createStore({
      "match-1": {
        status: "available",
        lineupsStatus: "available",
        statsStatus: "available",
        lastFetchedAt: "2026-06-15T00:50:00.000Z"
      }
    });
    const provider = createProvider(providerDetails());

    await expect(ensureMatchDetailsForMatches({
      matches: [match()],
      provider,
      store,
      now: fixedNow
    })).resolves.toMatchObject({
      failureMessages: [],
      fetched: 0,
      skippedFresh: 1
    });

    expect(provider.fetchMatchDetails).not.toHaveBeenCalled();
  });

  test("waits before retrying unavailable cache", async () => {
    const store = createStore({
      "match-1": {
        status: "unavailable",
        lineupsStatus: "unavailable",
        statsStatus: "unavailable",
        lastFetchedAt: "2026-06-15T00:45:00.000Z"
      }
    });
    const provider = createProvider(providerDetails());

    await expect(ensureMatchDetailsForMatches({
      matches: [match()],
      provider,
      store,
      now: fixedNow
    })).resolves.toMatchObject({
      failureMessages: [],
      fetched: 0,
      skippedFresh: 1
    });

    expect(provider.fetchMatchDetails).not.toHaveBeenCalled();
  });

  test("force refresh fetches even when unavailable cache is still fresh", async () => {
    const store = createStore({
      "match-1": {
        status: "unavailable",
        lineupsStatus: "unavailable",
        statsStatus: "unavailable",
        lastFetchedAt: "2026-06-15T00:45:00.000Z"
      }
    });
    const provider = createProvider(providerDetails());

    await expect(ensureMatchDetailsForMatches({
      matches: [match()],
      provider,
      store,
      now: fixedNow,
      force: true
    })).resolves.toMatchObject({
      failureMessages: [],
      fetched: 1,
      saved: 1,
      skippedFresh: 0
    });

    expect(provider.fetchMatchDetails).toHaveBeenCalledWith("123");
  });

  test("skips non-numeric API ids", async () => {
    const store = createStore();
    const provider = createProvider(providerDetails());

    await expect(ensureMatchDetailsForMatches({
      matches: [match({ apiMatchId: "wc2026-irn-nzl" })],
      provider,
      store,
      now: fixedNow
    })).resolves.toMatchObject({
      failureMessages: [],
      fetched: 0,
      skippedInvalidApiId: 1
    });

    expect(provider.fetchMatchDetails).not.toHaveBeenCalled();
  });

  test("records failed fetch attempts", async () => {
    const store = createStore();
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn(),
      fetchMatchDetails: vi.fn().mockRejectedValue(new Error("quota exhausted"))
    };

    await expect(ensureMatchDetailsForMatches({
      matches: [match()],
      provider,
      store,
      now: fixedNow
    })).resolves.toMatchObject({
      failureMessages: ["quota exhausted"],
      fetched: 1,
      saved: 0,
      failed: 1
    });

    expect(store.failures).toEqual([
      {
        matchId: "match-1",
        provider: "api-football",
        fetchedAt: "2026-06-15T01:00:00.000Z",
        errorMessage: "quota exhausted"
      }
    ]);
  });
});

function fixedNow(): Date {
  return new Date("2026-06-15T01:00:00.000Z");
}

function match(overrides: Partial<AppMatch> = {}): AppMatch {
  return {
    id: "match-1",
    apiMatchId: "123",
    homeTeam: {
      id: "team-home",
      name: "Netherlands",
      shortCode: "NED"
    },
    awayTeam: {
      id: "team-away",
      name: "Japan",
      shortCode: "JPN"
    },
    kickoffAt: "2026-06-15T20:00:00.000Z",
    stage: "Group F",
    groupName: "F",
    status: "scheduled",
    ...overrides
  };
}

function providerDetails(): ProviderMatchDetails {
  return {
    apiMatchId: "123",
    lineupsStatus: "available",
    statisticsStatus: "available",
    lineups: [
      {
        providerTeamId: "111",
        teamName: "Netherlands",
        formation: "4-2-3-1",
        coachName: "Ronald Koeman",
        players: []
      },
      {
        providerTeamId: "222",
        teamName: "Japan",
        formation: "4-3-3",
        coachName: "Hajime Moriyasu",
        players: []
      }
    ],
    statistics: [
      {
        providerTeamId: "111",
        teamName: "Netherlands",
        statName: "Ball Possession",
        statValue: "58%",
        sortOrder: 0
      }
    ],
    rawPayload: {
      lineups: [],
      statistics: []
    }
  };
}

function createProvider(details: ProviderMatchDetails): FootballProvider {
  return {
    name: "api-football",
    fetchUpdates: vi.fn(),
    fetchMatchDetails: vi.fn().mockResolvedValue(details)
  };
}

function createStore(cache: Record<string, Awaited<ReturnType<MatchDetailsCacheStore["getCache"]>>> = {}) {
  const saved: Array<Parameters<MatchDetailsCacheStore["saveDetails"]>[0]> = [];
  const failures: Array<Parameters<MatchDetailsCacheStore["recordFailure"]>[0]> = [];
  const store: MatchDetailsCacheStore & {
    saved: typeof saved;
    failures: typeof failures;
  } = {
    saved,
    failures,
    getCache: vi.fn(async (matchId: string) => cache[matchId] ?? null),
    saveDetails: vi.fn(async (payload) => {
      saved.push(payload);
    }),
    recordFailure: vi.fn(async (payload) => {
      failures.push(payload);
    })
  };

  return store;
}
