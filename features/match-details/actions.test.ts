import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getMatchByRouteId } from "@/features/matches/data";
import { ensureMatchDetailsForMatches } from "./cache";
import { refreshMatchDetails } from "./actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/players/session", () => ({
  getPlayerSessionForRoom: vi.fn()
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

vi.mock("@/features/sync/api-football-provider", () => ({
  createApiFootballProvider: vi.fn(() => ({ name: "api-football" }))
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("room creator can force refresh match lineups and stats", async () => {
  vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabase("creator-player") as never);
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "creator-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });
  vi.mocked(getMatchByRouteId).mockResolvedValue(match());
  vi.mocked(ensureMatchDetailsForMatches).mockResolvedValue({
    fetched: 1,
    saved: 1,
    skippedFresh: 0,
    skippedInvalidApiId: 0,
    failed: 0
  });

  await expect(refreshMatchDetails("world-cup-room", "123")).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room/matches/123?details=checked"
  );

  expect(ensureMatchDetailsForMatches).toHaveBeenCalledWith(expect.objectContaining({
    force: true,
    matches: [expect.objectContaining({ apiMatchId: "123" })]
  }));
});

test("non-creators cannot force refresh match details", async () => {
  vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabase("creator-player") as never);
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "member-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });
  vi.mocked(getMatchByRouteId).mockResolvedValue(match());

  await expect(refreshMatchDetails("world-cup-room", "123")).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room/matches/123?details=permission"
  );

  expect(ensureMatchDetailsForMatches).not.toHaveBeenCalled();
});

function createSupabase(creatorPlayerId: string) {
  return {
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "room-1",
                  slug: "world-cup-room",
                  creator_player_id: creatorPlayerId
                },
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
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
    status: "scheduled" as const
  };
}
