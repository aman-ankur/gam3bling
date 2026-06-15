import { beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getRoomMatchPicks } from "./data";
import type { AppMatch } from "@/features/matches/data";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/features/players/session", () => ({
  getPlayerSessionForRoom: vi.fn(async () => null)
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
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue(null);
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

test("collapses duplicate display names to the latest saved room prediction", async () => {
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "amanwa-new",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });
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
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    player_id: "amanwa-old",
                    joined_at: "2026-06-14T10:00:00.000Z",
                    players: { display_name: "Amanwa", avatar_initials: "A" }
                  },
                  {
                    player_id: "friend",
                    joined_at: "2026-06-14T11:00:00.000Z",
                    players: { display_name: "Kamesh", avatar_initials: "K" }
                  },
                  {
                    player_id: "amanwa-new",
                    joined_at: "2026-06-14T12:00:00.000Z",
                    players: { display_name: " Amanwa ", avatar_initials: "A" }
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "predictions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    player_id: "amanwa-old",
                    final_home_score: 4,
                    final_away_score: 1,
                    halftime_home_score: 2,
                    halftime_away_score: 0,
                    match_result: "home",
                    first_scoring_team_id: "home-team",
                    last_scoring_team_id: "home-team",
                    score_total: 0,
                    submitted_at: "2026-06-14T13:00:00.000Z"
                  },
                  {
                    player_id: "amanwa-new",
                    final_home_score: 2,
                    final_away_score: 1,
                    halftime_home_score: 1,
                    halftime_away_score: 0,
                    match_result: "home",
                    first_scoring_team_id: "home-team",
                    last_scoring_team_id: "away-team",
                    score_final: 10,
                    score_result: 5,
                    score_halftime: 6,
                    score_first_scorer: 0,
                    score_last_scorer: 0,
                    score_total: 0,
                    scored_at: "2026-06-14T15:00:00.000Z",
                    submitted_at: "2026-06-14T14:00:00.000Z"
                  }
                ],
                error: null
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  } as never);

  const picks = await getRoomMatchPicks("world-cup-room", match);

  expect(picks.map((pick) => pick.playerName)).toEqual(["Kamesh", "Amanwa"]);
  expect(picks.find((pick) => pick.playerName === "Amanwa")).toMatchObject({
    finalScore: "2-1",
    halftimeScore: "1-0",
    isCurrentPlayer: true,
    saved: true,
    scoreFinal: 10,
    scoreResult: 5,
    scoreHalftime: 6,
    scoreFirstScorer: 0,
    scoreLastScorer: 0,
    scoredAt: "2026-06-14T15:00:00.000Z"
  });
});
