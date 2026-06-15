import { beforeEach, describe, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { syncMatchResult } from "@/features/sync/sync-matches";
import { checkMatchResult } from "./actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/sync/sync-matches", () => ({
  syncMatchResult: vi.fn()
}));

describe("checkMatchResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T18:00:00.000Z"));
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
