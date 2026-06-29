import { describe, expect, test, vi } from "vitest";
import { syncMatches, syncMatchResult } from "./sync-matches";
import type { FootballProvider } from "./provider";

describe("syncMatches", () => {
  test("updates matches, writes logs, and scores predictions for final results", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 2,
          final_away_score: 1,
          match_result: "home",
          halftime_home_score: 1,
          halftime_away_score: 0,
          first_scoring_team_id: null,
          last_scoring_team_id: null
        }
      ]
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "final",
          homeScore: 2,
          awayScore: 1,
          winner: "home",
          homeHalftimeScore: 1,
          awayHalftimeScore: 0,
          firstScoringTeamExternalId: null,
          lastScoringTeamExternalId: null,
          kickoffAt: "2026-06-14T17:00:00.000Z"
        }
      ])
    };

    await expect(syncMatches({ supabase: db.client, provider, now: fixedNow })).resolves.toEqual({
      fetchedMatches: 1,
      updatedMatches: 1,
      scoredPredictions: 1,
      skippedMatches: 0
    });

    expect(provider.fetchUpdates).toHaveBeenCalledWith([
      expect.objectContaining({
        localMatchId: "match-1",
        apiProvider: "api-football",
        apiMatchId: "123"
      })
    ]);
    expect(db.matchUpdates).toEqual([
      {
        id: "match-1",
        payload: {
          status: "final",
          home_score: 2,
          away_score: 1,
          home_halftime_score: 1,
          away_halftime_score: 0,
          home_penalty_score: null,
          away_penalty_score: null,
          winner: "home",
          first_scoring_team_id: null,
          last_scoring_team_id: null,
          kickoff_at: "2026-06-14T17:00:00.000Z",
          last_synced_at: "2026-06-14T12:00:00.000Z",
          updated_at: "2026-06-14T12:00:00.000Z"
        }
      }
    ]);
    expect(db.predictionUpdates).toEqual([
      {
        id: "prediction-1",
        payload: {
          score_final: 10,
          score_result: 5,
          score_halftime: 6,
          score_first_scorer: 0,
          score_last_scorer: 0,
          score_penalty: 0,
          score_total: 21,
          scored_at: "2026-06-14T12:00:00.000Z"
        }
      }
    ]);
    expect(db.logs.map((log) => log.status)).toEqual(["started", "success"]);
  });

  test("writes a failed sync log when the provider errors", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      predictions: []
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn().mockRejectedValue(new Error("quota exhausted"))
    };

    await expect(syncMatches({ supabase: db.client, provider, now: fixedNow })).rejects.toThrow("quota exhausted");
    expect(db.logs).toEqual([
      expect.objectContaining({ status: "started" }),
      expect.objectContaining({ status: "failed", message: "quota exhausted" })
    ]);
  });

  test("maps provider event team ids to local home and away teams before scoring scorer markets", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          home_team_id: "team-home",
          away_team_id: "team-away",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 2,
          final_away_score: 1,
          match_result: "home",
          halftime_home_score: 1,
          halftime_away_score: 0,
          first_scoring_team_id: "team-home",
          last_scoring_team_id: "team-away"
        }
      ]
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "final",
          homeScore: 2,
          awayScore: 1,
          homeTeamExternalId: "111",
          awayTeamExternalId: "222",
          winner: "home",
          homeHalftimeScore: 1,
          awayHalftimeScore: 0,
          firstScoringTeamExternalId: "111",
          lastScoringTeamExternalId: "222"
        }
      ])
    };

    await expect(syncMatches({ supabase: db.client, provider, now: fixedNow })).resolves.toMatchObject({
      scoredPredictions: 1
    });

    expect(db.matchUpdates[0].payload).toMatchObject({
      first_scoring_team_id: "team-home",
      last_scoring_team_id: "team-away"
    });
    expect(db.predictionUpdates[0].payload).toMatchObject({
      score_first_scorer: 4,
      score_last_scorer: 4,
      score_total: 29
    });
  });

  test("matches fallback provider updates by local match id when provider ids differ", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_provider: "api-football",
          api_match_id: "1489380",
          kickoff_at: "2026-06-14T04:00:00.000Z",
          home_team_id: "team-home",
          away_team_id: "team-away",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      teams: [
        { id: "team-home", name: "Spain", short_code: "ESP" },
        { id: "team-away", name: "Cape Verde", short_code: "CPV" }
      ],
      predictions: []
    });
    const provider: FootballProvider = {
      name: "espn",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          localMatchId: "match-1",
          apiMatchId: "760428",
          status: "live",
          homeScore: 1,
          awayScore: 0,
          homeTeamExternalId: "164",
          awayTeamExternalId: "2597",
          winner: "home"
        }
      ]),
      fetchMatchDetails: vi.fn()
    };

    await expect(syncMatches({ supabase: db.client, provider, now: fixedNow })).resolves.toMatchObject({
      fetchedMatches: 1,
      updatedMatches: 1,
      skippedMatches: 0
    });

    expect(provider.fetchUpdates).toHaveBeenCalledWith([
      {
        localMatchId: "match-1",
        apiProvider: "api-football",
        apiMatchId: "1489380",
        kickoffAt: "2026-06-14T04:00:00.000Z",
        homeTeam: { id: "team-home", name: "Spain", shortCode: "ESP" },
        awayTeam: { id: "team-away", name: "Cape Verde", shortCode: "CPV" }
      }
    ]);
    expect(db.matchUpdates).toEqual([
      {
        id: "match-1",
        payload: expect.objectContaining({
          status: "live",
          home_score: 1,
          away_score: 0
        })
      }
    ]);
  });
});

describe("syncMatchResult", () => {
  test("updates one final match and scores its predictions", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          status: "scheduled",
          home_score: null,
          away_score: null
        },
        {
          id: "match-2",
          api_match_id: "456",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 2,
          final_away_score: 1,
          match_result: "home",
          halftime_home_score: 1,
          halftime_away_score: 0,
          first_scoring_team_id: null,
          last_scoring_team_id: null
        },
        {
          id: "prediction-2",
          match_id: "match-2",
          final_home_score: 1,
          final_away_score: 1,
          match_result: "draw",
          halftime_home_score: 0,
          halftime_away_score: 0,
          first_scoring_team_id: null,
          last_scoring_team_id: null
        }
      ]
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "final",
          homeScore: 2,
          awayScore: 1,
          winner: "home",
          homeHalftimeScore: 1,
          awayHalftimeScore: 0,
          firstScoringTeamExternalId: null,
          lastScoringTeamExternalId: null,
          kickoffAt: "2026-06-14T17:00:00.000Z"
        }
      ])
    };

    await expect(syncMatchResult({ supabase: db.client, matchId: "match-1", provider, now: fixedNow })).resolves.toEqual({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 1,
      status: "final"
    });

    expect(provider.fetchUpdates).toHaveBeenCalledWith([
      expect.objectContaining({
        localMatchId: "match-1",
        apiProvider: "api-football",
        apiMatchId: "123"
      })
    ]);
    expect(db.matchUpdates.map((update) => update.id)).toEqual(["match-1"]);
    expect(db.predictionUpdates).toHaveLength(1);
    expect(db.predictionUpdates[0]).toMatchObject({
      id: "prediction-1",
      payload: {
        score_final: 10,
        score_result: 5,
        score_halftime: 6,
        score_total: 21
      }
    });
  });

  test("updates one non-final match without scoring predictions", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          status: "scheduled",
          home_score: null,
          away_score: null
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 2,
          final_away_score: 1,
          match_result: "home",
          halftime_home_score: 1,
          halftime_away_score: 0,
          first_scoring_team_id: null,
          last_scoring_team_id: null
        }
      ]
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "live",
          homeScore: 1,
          awayScore: 0,
          winner: "home",
          homeHalftimeScore: 1,
          awayHalftimeScore: 0,
          firstScoringTeamExternalId: null,
          lastScoringTeamExternalId: null
        }
      ])
    };

    await expect(syncMatchResult({ supabase: db.client, matchId: "match-1", provider, now: fixedNow })).resolves.toEqual({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 0,
      status: "live"
    });

    expect(db.matchUpdates).toEqual([
      {
        id: "match-1",
        payload: expect.objectContaining({
          status: "live",
          home_score: 1,
          away_score: 0,
          last_synced_at: "2026-06-14T12:00:00.000Z"
        })
      }
    ]);
    expect(db.predictionUpdates).toEqual([]);
  });

  test("does not score an unresolved knockout draw without penalty scores", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          stage: "Round of 32",
          status: "live",
          home_score: 1,
          away_score: 1
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 1,
          final_away_score: 1,
          match_result: "draw",
          halftime_home_score: 0,
          halftime_away_score: 0,
          penalty_home_score: 5,
          penalty_away_score: 4,
          first_scoring_team_id: null,
          last_scoring_team_id: null
        }
      ]
    });
    const provider: FootballProvider = {
      name: "espn",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "final",
          homeScore: 1,
          awayScore: 1,
          winner: "draw",
          homeHalftimeScore: 0,
          awayHalftimeScore: 0
        }
      ])
    };

    await expect(syncMatchResult({ supabase: db.client, matchId: "match-1", provider, now: fixedNow })).resolves.toEqual({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 0,
      status: "live"
    });

    expect(db.matchUpdates[0]).toEqual({
      id: "match-1",
      payload: expect.objectContaining({
        status: "live",
        home_score: 1,
        away_score: 1,
        home_penalty_score: null,
        away_penalty_score: null,
        winner: "draw"
      })
    });
    expect(db.predictionUpdates).toEqual([]);
  });

  test("anchors live match kickoff from provider clock when available", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_match_id: "123",
          kickoff_at: "2026-06-14T04:00:00.000Z",
          status: "live",
          home_score: 0,
          away_score: 0
        }
      ],
      predictions: []
    });
    const provider: FootballProvider = {
      name: "espn",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          apiMatchId: "123",
          status: "live",
          homeScore: 1,
          awayScore: 1,
          matchClock: "36:29",
          winner: "draw"
        }
      ])
    };

    await expect(syncMatchResult({ supabase: db.client, matchId: "match-1", provider, now: fixedNow })).resolves.toMatchObject({
      updatedMatch: true,
      status: "live"
    });

    expect(db.matchUpdates[0].payload).toMatchObject({
      status: "live",
      home_score: 1,
      away_score: 1,
      kickoff_at: "2026-06-14T11:23:31.000Z"
    });
  });

  test("settles a demo match without calling the external provider", async () => {
    const db = createFakeSyncDb({
      matches: [
        {
          id: "match-1",
          api_provider: "demo",
          api_match_id: "demo-world-cup-room",
          status: "live",
          home_team_id: "home-team",
          away_team_id: "away-team",
          home_score: null,
          away_score: null
        }
      ],
      predictions: [
        {
          id: "prediction-1",
          match_id: "match-1",
          final_home_score: 2,
          final_away_score: 1,
          match_result: "home",
          halftime_home_score: 1,
          halftime_away_score: 0,
          first_scoring_team_id: "home-team",
          last_scoring_team_id: "away-team"
        }
      ]
    });
    const provider: FootballProvider = {
      name: "api-football",
      fetchUpdates: vi.fn()
    };

    await expect(syncMatchResult({ supabase: db.client, matchId: "match-1", provider, now: fixedNow })).resolves.toEqual({
      found: true,
      fetchedMatches: 1,
      updatedMatch: true,
      scoredPredictions: 1,
      status: "final"
    });

    expect(provider.fetchUpdates).not.toHaveBeenCalled();
    expect(db.matchUpdates).toEqual([
      {
        id: "match-1",
        payload: expect.objectContaining({
          status: "final",
          home_score: 2,
          away_score: 1,
          home_halftime_score: 1,
          away_halftime_score: 0,
          winner: "home",
          first_scoring_team_id: "home-team",
          last_scoring_team_id: "away-team"
        })
      }
    ]);
    expect(db.predictionUpdates[0]).toMatchObject({
      payload: {
        score_final: 10,
        score_result: 5,
        score_halftime: 6,
        score_first_scorer: 4,
        score_last_scorer: 4,
        score_penalty: 0,
        score_total: 29,
        scored_at: "2026-06-14T12:00:00.000Z"
      }
    });
  });
});

function fixedNow(): Date {
  return new Date("2026-06-14T12:00:00.000Z");
}

function createFakeSyncDb({
  matches,
  predictions,
  teams = [
    { id: "team-home", name: "Home", short_code: "HOM" },
    { id: "team-away", name: "Away", short_code: "AWY" }
  ]
}: {
  matches: Array<Record<string, unknown>>;
  predictions: Array<Record<string, unknown>>;
  teams?: Array<Record<string, unknown>>;
}) {
  const normalizedMatches = matches.map((match) => ({
    api_provider: "api-football",
    home_team_id: "team-home",
    away_team_id: "team-away",
    kickoff_at: "2026-06-14T04:00:00.000Z",
    ...match
  }));
  const logs: Array<Record<string, unknown>> = [];
  const matchUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const predictionUpdates: Array<{ id: string; payload: Record<string, unknown> }> = [];

  return {
    logs,
    matchUpdates,
    predictionUpdates,
    client: {
      from(table: string) {
        if (table === "sync_logs") {
          return {
            insert: async (payload: Record<string, unknown>) => {
              logs.push(payload);
              return { error: null };
            }
          };
        }

        if (table === "matches") {
          return {
            select: () => ({
              not: async () => ({ data: normalizedMatches, error: null }),
              eq: (_column: string, value: string) => ({
                single: async () => ({
                  data: normalizedMatches.find((match) => match.id === value) ?? null,
                  error: null
                })
              })
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async (_column: string, id: string) => {
                matchUpdates.push({ id, payload });
                return { error: null };
              }
            })
          };
        }

        if (table === "predictions") {
          return {
            select: () => ({
              eq: async (_column: string, matchId: string) => ({
                data: predictions.filter((prediction) => prediction.match_id === matchId),
                error: null
              })
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async (_column: string, id: string) => {
                predictionUpdates.push({ id, payload });
                return { error: null };
              }
            })
          };
        }

        if (table === "teams") {
          return {
            select: () => Promise.resolve({ data: teams, error: null })
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }
    }
  };
}
