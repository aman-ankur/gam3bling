import { beforeEach, expect, test, vi } from "vitest";
import { setPlayerSession } from "@/features/players/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createDemoRoom } from "./actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("@/features/players/session", () => ({
  hashSecret: vi.fn((value: string) => `hash:${value}`),
  setPlayerSession: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("creates a complete demo room and redirects to its locked match", async () => {
  const inserts: Record<string, unknown[]> = {
    players: [],
    rooms: [],
    room_members: [],
    matches: [],
    predictions: []
  };
  const supabase = createDemoSupabase(inserts);
  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(createDemoRoom()).rejects.toThrow(/NEXT_REDIRECT:\/r\/demo-room-[a-f0-9]{6}\/matches\/demo-demo-room-[a-f0-9]{6}\?saved=1/);

  expect(inserts.players).toHaveLength(4);
  expect(inserts.rooms).toHaveLength(1);
  expect(inserts.room_members).toHaveLength(4);
  expect(inserts.matches).toHaveLength(1);
  expect(inserts.predictions).toHaveLength(4);
  expect(inserts.matches[0]).toMatchObject({
    api_provider: "demo",
    status: "live",
    home_team_id: "team-ned",
    away_team_id: "team-jpn"
  });
  expect(inserts.predictions[0]).toMatchObject({
    final_home_score: 2,
    final_away_score: 1,
    match_result: "home",
    first_scoring_team_id: "team-ned",
    last_scoring_team_id: "team-jpn"
  });
  expect(setPlayerSession).toHaveBeenCalledWith({
    playerId: "player-1",
    roomId: expect.stringMatching(/^room-/),
    roomSlug: expect.stringMatching(/^demo-room-[a-f0-9]{6}$/)
  });
});

test("retries transient demo match insert failures", async () => {
  const inserts: Record<string, unknown[]> = {
    players: [],
    rooms: [],
    room_members: [],
    matches: [],
    predictions: []
  };
  const supabase = createDemoSupabase(inserts, {
    matchInsertResults: [
      { data: null, error: { message: "TypeError: fetch failed" } },
      { data: { id: "match-1", api_match_id: "demo-retried" }, error: null }
    ]
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(createDemoRoom()).rejects.toThrow(/NEXT_REDIRECT:\/r\/demo-room-[a-f0-9]{6}\/matches\/demo-retried\?saved=1/);

  expect(inserts.matches).toHaveLength(1);
  expect(inserts.predictions).toHaveLength(4);
});

function createDemoSupabase(
  inserts: Record<string, unknown[]>,
  options: {
    matchInsertResults?: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  } = {}
) {
  let matchInsertAttempt = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "tournaments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: "tournament-1" }, error: null }))
                }))
              }))
            }))
          }))
        };
      }

      if (table === "teams") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "team-ned", short_code: "NED" },
                { id: "team-jpn", short_code: "JPN" }
              ],
              error: null
            }))
          }))
        };
      }

      if (table === "players") {
        return {
          insert: vi.fn((rows: unknown[]) => {
            inserts.players.push(...rows);

            return {
              select: vi.fn(async () => ({
                data: rows.map((_row, index) => ({ id: `player-${index + 1}` })),
                error: null
              }))
            };
          })
        };
      }

      if (table === "rooms") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            inserts.rooms.push(row);

            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: `room-${inserts.rooms.length}`, slug: row.slug }, error: null }))
              }))
            };
          })
        };
      }

      if (table === "matches") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  const configuredResult = options.matchInsertResults?.[Math.min(matchInsertAttempt, options.matchInsertResults.length - 1)];
                  matchInsertAttempt += 1;

                  if (configuredResult?.error) {
                    return configuredResult;
                  }

                  inserts.matches.push(row);
                  return configuredResult ?? { data: { id: "match-1", api_match_id: row.api_match_id }, error: null };
                })
              }))
            };
          })
        };
      }

      if (table === "room_members" || table === "predictions") {
        return {
          insert: vi.fn(async (rows: unknown[]) => {
            inserts[table].push(...rows);
            return { error: null };
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
}
