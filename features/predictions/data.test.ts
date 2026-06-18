import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getCurrentPlayerMatchPickSummaries, getRoomHistoryMatches, getRoomMatchPicks } from "./data";
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

afterEach(() => {
  vi.useRealTimers();
});

test("does not show fallback friend predictions when Supabase is unavailable", async () => {
  await expect(getRoomMatchPicks("missing-room", match)).resolves.toEqual([]);
});

test("keeps explicit e2e fallback friend predictions", async () => {
  process.env.E2E_USE_FALLBACK_FIXTURES = "1";

  const picks = await getRoomMatchPicks("world-cup-room", match);

  expect(picks.map((pick) => pick.playerName)).toEqual(["John Doe", "Jane Doe"]);
});

test("loads past room-predicted matches even when they are not final yet", async () => {
  vi.setSystemTime(new Date("2026-06-16T06:00:00.000Z"));
  vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseForRoomHistory() as never);

  const matches = await getRoomHistoryMatches("world-cup-room");

  expect(matches.map((historyMatch) => historyMatch.apiMatchId)).toEqual(["api-saudi-uruguay"]);
  expect(matches[0]).toMatchObject({
    status: "scheduled",
    homeTeam: { name: "Saudi Arabia" },
    awayTeam: { name: "Uruguay" }
  });
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

test("loads current player prediction summaries for visible room matches", async () => {
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "player-current",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseForCurrentPlayerSummaries() as never);

  const summaries = await getCurrentPlayerMatchPickSummaries("world-cup-room", [
    match,
    {
      ...match,
      id: "match-2",
      apiMatchId: "api-match-2",
      homeTeam: { id: "team-bel", name: "Belgium" },
      awayTeam: { id: "team-egy", name: "Egypt" }
    }
  ]);

  expect([...summaries.keys()]).toEqual(["match-2", "api-match-2"]);
  expect(summaries.get("api-match-2")).toEqual({
    finalScore: "2-0",
    halftimeScore: "1-0",
    result: "Belgium",
    scorers: "Belgium first, Egypt last"
  });
});

function createSupabaseForRoomHistory() {
  const teams = [
    { id: "team-ksa", name: "Saudi Arabia", short_code: "KSA", flag_code: "sa" },
    { id: "team-uru", name: "Uruguay", short_code: "URU", flag_code: "uy" },
    { id: "team-bel", name: "Belgium", short_code: "BEL", flag_code: "be" },
    { id: "team-egy", name: "Egypt", short_code: "EGY", flag_code: "eg" }
  ];
  const matchRows = [
    {
      id: "match-past",
      api_provider: "api-football",
      api_match_id: "api-saudi-uruguay",
      home_team_id: "team-ksa",
      away_team_id: "team-uru",
      kickoff_at: "2026-06-15T23:30:00.000Z",
      stage: "Group A",
      group_name: "A",
      status: "scheduled",
      home_score: null,
      away_score: null,
      home_halftime_score: null,
      away_halftime_score: null,
      first_scoring_team_id: null,
      last_scoring_team_id: null,
      last_synced_at: null
    },
    {
      id: "match-future",
      api_provider: "api-football",
      api_match_id: "api-belgium-egypt",
      home_team_id: "team-bel",
      away_team_id: "team-egy",
      kickoff_at: "2026-06-18T16:00:00.000Z",
      stage: "Group B",
      group_name: "B",
      status: "scheduled",
      home_score: null,
      away_score: null,
      home_halftime_score: null,
      away_halftime_score: null,
      first_scoring_team_id: null,
      last_scoring_team_id: null,
      last_synced_at: null
    }
  ];

  return {
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
                  { player_id: "player-1", joined_at: "2026-06-14T10:00:00.000Z", players: null },
                  { player_id: "player-2", joined_at: "2026-06-14T11:00:00.000Z", players: null }
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
            in: vi.fn(async () => ({
              data: [
                { match_id: "match-past", submitted_at: "2026-06-15T10:00:00.000Z" },
                { match_id: "match-future", submitted_at: "2026-06-15T11:00:00.000Z" },
                { match_id: "match-past", submitted_at: "2026-06-15T12:00:00.000Z" }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: matchRows, error: null }))
          }))
        };
      }

      if (table === "teams") {
        return {
          select: vi.fn(async () => ({ data: teams, error: null }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
}

function createSupabaseForCurrentPlayerSummaries() {
  return {
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
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { player_id: "player-current" }, error: null }))
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
                    match_id: "match-2",
                    final_home_score: 2,
                    final_away_score: 0,
                    halftime_home_score: 1,
                    halftime_away_score: 0,
                    match_result: "home",
                    first_scoring_team_id: "team-bel",
                    last_scoring_team_id: "team-egy"
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
  };
}
