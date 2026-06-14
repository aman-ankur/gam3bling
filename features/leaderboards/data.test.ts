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
