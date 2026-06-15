import { beforeEach, describe, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMatchByRouteId } from "@/features/matches/data";
import { ensureMatchDetailsForMatches } from "@/features/match-details/cache";
import { syncMatches, syncMatchResult } from "@/features/sync/sync-matches";
import { checkMatchResult, refreshMatchScore, refreshRoomScores } from "./actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/matches/data", () => ({
  getMatchByRouteId: vi.fn()
}));

vi.mock("@/features/match-details/cache", () => ({
  ensureMatchDetailsForMatches: vi.fn()
}));

vi.mock("@/features/match-details/data", () => ({
  createSupabaseMatchDetailsStore: vi.fn(() => ({ kind: "store" }))
}));

vi.mock("@/features/sync/default-provider", () => ({
  createDefaultFootballProvider: vi.fn(() => ({ name: "espn+api-football" }))
}));

vi.mock("@/features/sync/sync-matches", () => ({
  syncMatches: vi.fn(),
  syncMatchResult: vi.fn()
}));

describe("checkMatchResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T18:00:00.000Z"));
    vi.mocked(getMatchByRouteId).mockResolvedValue(match());
    vi.mocked(ensureMatchDetailsForMatches).mockResolvedValue({
      failureMessages: [],
      fetched: 1,
      saved: 1,
      skippedFresh: 0,
      skippedInvalidApiId: 0,
      failed: 0
    });
  });

  test("redirects early without syncing before the result window opens", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:10:00.000Z",
      last_synced_at: null,
      status: "scheduled"
    }) as never);

    await expect(checkMatchResult("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?result=early"
    );

    expect(syncMatchResult).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/r/world-cup-room/matches/123?result=early");
  });

  test("redirects cooldown without syncing when the match was checked within five minutes", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:00:00.000Z",
      last_synced_at: "2026-06-15T17:58:00.000Z",
      status: "live"
    }) as never);

    await expect(checkMatchResult("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?result=cooldown"
    );

    expect(syncMatchResult).not.toHaveBeenCalled();
  });

  test("syncs an available match and redirects to checked when final", async () => {
    const supabase = createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:00:00.000Z",
      last_synced_at: null,
      status: "live"
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(syncMatchResult).mockResolvedValue({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 3,
      status: "final"
    });

    await expect(checkMatchResult("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?result=checked"
    );

    expect(syncMatchResult).toHaveBeenCalledWith({ supabase, matchId: "match-1" });
  });

  test("retries transient match lookup errors before deciding the match is missing", async () => {
    vi.useRealTimers();

    const supabase = createSupabaseWithMatchLookupSequence([
      {
        data: null,
        error: { message: "TypeError: fetch failed" }
      },
      {
        data: {
          id: "match-1",
          api_match_id: "123",
          kickoff_at: "2020-06-15T16:00:00.000Z",
          last_synced_at: null,
          status: "live"
        },
        error: null
      }
    ]);
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(syncMatchResult).mockResolvedValue({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 3,
      status: "final"
    });

    await expect(checkMatchResult("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?result=checked"
    );

    expect(syncMatchResult).toHaveBeenCalledWith({ supabase, matchId: "match-1" });
  });

  test("syncs an available match and redirects to pending when not final", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:00:00.000Z",
      last_synced_at: null,
      status: "live"
    }) as never);
    vi.mocked(syncMatchResult).mockResolvedValue({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 0,
      status: "live"
    });

    await expect(checkMatchResult("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?result=pending"
    );
  });

  test("refreshes one live match and match details on demand before the final result window", async () => {
    const supabase = createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:10:00.000Z",
      last_synced_at: null,
      status: "live"
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(syncMatchResult).mockResolvedValue({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 0,
      status: "live"
    });

    await expect(refreshMatchScore("world-cup-room", "123")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room/matches/123?score=refreshed"
    );

    expect(syncMatchResult).toHaveBeenCalledWith({ supabase, matchId: "match-1" });
    expect(ensureMatchDetailsForMatches).toHaveBeenCalledWith(expect.objectContaining({
      force: true,
      matches: [expect.objectContaining({ apiMatchId: "123" })]
    }));
  });

  test("refreshes room scores on demand", async () => {
    const supabase = createSupabaseWithMatch({
      id: "match-1",
      api_match_id: "123",
      kickoff_at: "2026-06-15T16:10:00.000Z",
      last_synced_at: null,
      status: "live"
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(syncMatches).mockResolvedValue({
      fetchedMatches: 2,
      updatedMatches: 2,
      scoredPredictions: 0,
      skippedMatches: 0
    });

    await expect(refreshRoomScores("world-cup-room")).rejects.toThrow(
      "NEXT_REDIRECT:/r/world-cup-room?hub=1&scores=refreshed"
    );

    expect(syncMatches).toHaveBeenCalledWith({ supabase });
  });
});

function createSupabaseWithMatch(match: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "matches") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn((_column: string, value: string) => ({
            maybeSingle: vi.fn(async () => ({
              data: match.api_match_id === value || match.id === value ? match : null,
              error: null
            }))
          }))
        }))
      };
    })
  };
}

function match() {
  return {
    id: "match-1",
    apiMatchId: "123",
    homeTeam: { id: "home-team", name: "Netherlands", shortCode: "NED" },
    awayTeam: { id: "away-team", name: "Japan", shortCode: "JPN" },
    kickoffAt: "2026-06-15T20:00:00.000Z",
    stage: "Group F",
    groupName: "F",
    status: "live" as const
  };
}

function createSupabaseWithMatchLookupSequence(results: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>) {
  let index = 0;

  return {
    from: vi.fn((table: string) => {
      if (table !== "matches") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              const result = results[Math.min(index, results.length - 1)];
              index += 1;

              return result;
            })
          }))
        }))
      };
    })
  };
}
