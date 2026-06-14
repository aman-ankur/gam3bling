import { describe, expect, test, vi } from "vitest";
import { syncMatches } from "./sync-matches";
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

    expect(provider.fetchUpdates).toHaveBeenCalledWith(["123"]);
    expect(db.matchUpdates).toEqual([
      {
        id: "match-1",
        payload: {
          status: "final",
          home_score: 2,
          away_score: 1,
          home_halftime_score: 1,
          away_halftime_score: 0,
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
});

function fixedNow(): Date {
  return new Date("2026-06-14T12:00:00.000Z");
}

function createFakeSyncDb({
  matches,
  predictions
}: {
  matches: Array<Record<string, unknown>>;
  predictions: Array<Record<string, unknown>>;
}) {
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
              not: async () => ({ data: matches, error: null })
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

        throw new Error(`Unexpected table ${table}`);
      }
    }
  };
}
