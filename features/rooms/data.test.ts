import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUpcomingMatches } from "@/features/matches/data";
import { getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSessions } from "@/features/players/session";
import { getCurrentPlayerRoomShortcuts, getRoomSummary } from "./data";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/matches/data", () => ({
  getUpcomingMatches: vi.fn(async () => [])
}));

vi.mock("@/features/matches/prediction-window", () => ({
  getOpenPredictionMatchIds: vi.fn(() => new Set<string>())
}));

vi.mock("@/features/players/session", () => ({
  getPlayerSession: vi.fn(async () => null),
  getPlayerSessions: vi.fn(async () => [])
}));

beforeEach(() => {
  vi.mocked(getSupabaseAdmin).mockReturnValue(null);
  delete process.env.E2E_USE_FALLBACK_FIXTURES;
});

test("does not show fallback members when Supabase is unavailable", async () => {
  const room = await getRoomSummary("missing-room");

  expect(room).toMatchObject({
    exists: false,
    id: "",
    name: "Missing Room",
    slug: "missing-room",
    members: []
  });
});

test("keeps explicit e2e fallback room members", async () => {
  process.env.E2E_USE_FALLBACK_FIXTURES = "1";

  const room = await getRoomSummary("world-cup-room");

  expect(room.exists).toBe(true);
  expect(room.members.map((member) => member.name)).toEqual(["John Doe", "Jane Doe", "Alex Doe", "Sam Doe"]);
});

test("returns shortcuts for every room stored in the current browser session", async () => {
  const match = {
    id: "match-1",
    apiMatchId: "api-match-1",
    stage: "Group A",
    kickoffAt: "2026-06-15T16:00:00Z",
    status: "scheduled",
    homeTeam: { id: "home-team", name: "Home", shortCode: "HOM", flagCode: "HM" },
    awayTeam: { id: "away-team", name: "Away", shortCode: "AWY", flagCode: "AW" }
  };

  vi.mocked(getUpcomingMatches).mockResolvedValue([match]);
  vi.mocked(getOpenPredictionMatchIds).mockReturnValue(new Set(["match-1"]));
  vi.mocked(getPlayerSessions).mockResolvedValue([
    { playerId: "player-new", roomId: "room-new", roomSlug: "new-room" },
    { playerId: "player-old", roomId: "room-old", roomSlug: "old-room" }
  ]);

  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "room-old", name: "Old Room", slug: "old-room" },
                { id: "room-new", name: "New Room", slug: "new-room" }
              ]
            }))
          }))
        };
      }

      if (table === "predictions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { player_id: "player-new", score_total: 5 },
                { player_id: "player-old", score_total: 7 },
                { player_id: "player-old", score_total: null }
              ]
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  } as never);

  const shortcuts = await getCurrentPlayerRoomShortcuts();

  expect(shortcuts.map((shortcut) => shortcut.name)).toEqual(["New Room", "Old Room"]);
  expect(shortcuts.map((shortcut) => shortcut.href)).toEqual(["/r/new-room", "/r/old-room"]);
  expect(shortcuts.map((shortcut) => shortcut.score)).toEqual([5, 7]);
  expect(shortcuts.map((shortcut) => shortcut.savedCount)).toEqual([1, 2]);
});
