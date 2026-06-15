import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGlobalLeaderboard, getRoomLeaderboard } from "./data";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

beforeEach(() => {
  vi.mocked(getSupabaseAdmin).mockReturnValue(null);
  delete process.env.E2E_USE_FALLBACK_FIXTURES;
});

test("returns an empty room leaderboard when Supabase is unavailable", async () => {
  await expect(getRoomLeaderboard("missing-room")).resolves.toEqual([]);
});

test("returns an empty global leaderboard when Supabase is unavailable", async () => {
  await expect(getGlobalLeaderboard()).resolves.toEqual([]);
});

test("keeps explicit e2e fallback leaderboard data", async () => {
  process.env.E2E_USE_FALLBACK_FIXTURES = "1";

  const leaderboard = await getRoomLeaderboard("world-cup-room");

  expect(leaderboard).toHaveLength(4);
  expect(leaderboard[0]).toMatchObject({ name: "John Doe", score: 48 });
});

test("collapses duplicate room leaderboard names using latest predictions per match", async () => {
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "room-1" }, error: null }))
            }))
          }))
        };
      }

      if (table === "room_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                { player_id: "amanwa-old", players: { display_name: "Amanwa", avatar_initials: "A" } },
                { player_id: "declan", players: { display_name: "Declan Rice", avatar_initials: "DR" } },
                { player_id: "amanwa-new", players: { display_name: " amanwa ", avatar_initials: "A" } }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === "predictions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  match_id: "match-1",
                  player_id: "amanwa-old",
                  score_total: 4,
                  submitted_at: "2026-06-14T12:00:00.000Z"
                },
                {
                  match_id: "match-1",
                  player_id: "amanwa-new",
                  score_total: 7,
                  submitted_at: "2026-06-14T13:00:00.000Z"
                },
                {
                  match_id: "match-2",
                  player_id: "amanwa-old",
                  score_total: 5,
                  submitted_at: "2026-06-14T14:00:00.000Z"
                },
                {
                  match_id: "match-1",
                  player_id: "declan",
                  score_total: 3,
                  submitted_at: "2026-06-14T13:30:00.000Z"
                }
              ],
              error: null
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  } as never);

  const leaderboard = await getRoomLeaderboard("world-cup-room");

  expect(leaderboard.map((entry) => entry.name)).toEqual(["Amanwa", "Declan Rice"]);
  expect(leaderboard[0]).toMatchObject({
    name: "Amanwa",
    score: 12,
    secondaryStat: "2 saved predictions"
  });
});
