import { describe, expect, test, vi } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMatchByRouteId } from "./data";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

describe("getMatchByRouteId", () => {
  test("loads a specific API match even when it is outside the general upcoming list", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseForSpecificMatch() as never);

    await expect(getMatchByRouteId("demo-demo-room-123abc")).resolves.toMatchObject({
      apiMatchId: "demo-demo-room-123abc",
      homeTeam: {
        name: "Netherlands"
      },
      awayTeam: {
        name: "Japan"
      },
      status: "final",
      homeScore: 2,
      awayScore: 1
    });
  });

  test("retries transient errors while loading a specific API match", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(createSupabaseForSpecificMatch({
      matchLookupResults: [
        { data: null, error: { message: "TypeError: fetch failed" } },
        { data: demoMatchRow(), error: null }
      ]
    }) as never);

    await expect(getMatchByRouteId("demo-demo-room-123abc")).resolves.toMatchObject({
      apiMatchId: "demo-demo-room-123abc",
      status: "final"
    });
  });
});

function demoMatchRow() {
  return {
    id: "match-1",
    api_match_id: "demo-demo-room-123abc",
    home_team_id: "team-ned",
    away_team_id: "team-jpn",
    kickoff_at: "2026-06-15T11:30:00.000Z",
    stage: "Demo Final",
    group_name: "Demo",
    status: "final",
    home_score: 2,
    away_score: 1,
    first_scoring_team_id: "team-ned",
    last_scoring_team_id: "team-jpn",
    last_synced_at: "2026-06-15T13:46:07.993Z"
  };
}

function createSupabaseForSpecificMatch(options: {
  matchLookupResults?: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
} = {}) {
  const match = demoMatchRow();
  const teams = [
    { id: "team-ned", name: "Netherlands", short_code: "NED", flag_code: "nl" },
    { id: "team-jpn", name: "Japan", short_code: "JPN", flag_code: "jp" }
  ];
  let matchLookupAttempt = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "teams") {
        return {
          select: vi.fn(async () => ({ data: teams, error: null }))
        };
      }

      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [], error: null }))
            })),
            eq: vi.fn((column: string, value: string) => ({
              maybeSingle: vi.fn(async () => {
                const configuredResult = options.matchLookupResults?.[Math.min(matchLookupAttempt, options.matchLookupResults.length - 1)];
                matchLookupAttempt += 1;

                return configuredResult ?? {
                  data: column === "api_match_id" && value === match.api_match_id ? match : null,
                  error: null
                };
              })
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
}
