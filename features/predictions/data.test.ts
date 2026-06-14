import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlayerSession } from "@/features/players/session";
import { getRoomMatchPicks } from "./data";
import type { AppMatch } from "@/features/matches/data";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/players/session", () => ({
  getPlayerSession: vi.fn(async () => null)
}));

const match: AppMatch = {
  id: "match-1",
  apiMatchId: "api-match-1",
  stage: "Group A",
  kickoffAt: "2026-06-15T16:00:00Z",
  status: "scheduled",
  homeTeam: { id: "home-team", name: "Home" },
  awayTeam: { id: "away-team", name: "Away" }
};

beforeEach(() => {
  vi.mocked(getSupabaseAdmin).mockReturnValue(null);
  vi.mocked(getPlayerSession).mockResolvedValue(null);
  delete process.env.E2E_USE_FALLBACK_FIXTURES;
});

test("does not show fallback friend predictions when Supabase is unavailable", async () => {
  await expect(getRoomMatchPicks("missing-room", match)).resolves.toEqual([]);
});

test("keeps explicit e2e fallback friend predictions", async () => {
  process.env.E2E_USE_FALLBACK_FIXTURES = "1";

  const picks = await getRoomMatchPicks("world-cup-room", match);

  expect(picks.map((pick) => pick.playerName)).toEqual(["John Doe", "Jane Doe"]);
});
