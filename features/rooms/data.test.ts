import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRoomSummary } from "./data";

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
  getPlayerSession: vi.fn(async () => null)
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
