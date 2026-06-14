import { describe, expect, test, vi } from "vitest";
import {
  createApiFootballProvider,
  normalizeApiFootballFixture,
  normalizeApiFootballStatus
} from "./api-football-provider";

describe("normalizeApiFootballStatus", () => {
  test.each([
    ["TBD", "scheduled"],
    ["NS", "scheduled"],
    ["1H", "live"],
    ["2H", "live"],
    ["ET", "live"],
    ["BT", "live"],
    ["HT", "halftime"],
    ["FT", "final"],
    ["AET", "final"],
    ["PEN", "final"],
    ["PST", "postponed"],
    ["SUSP", "postponed"],
    ["CANC", "postponed"],
    ["ABD", "postponed"]
  ] as const)("maps %s to %s", (providerStatus, expectedStatus) => {
    expect(normalizeApiFootballStatus(providerStatus)).toBe(expectedStatus);
  });
});

describe("normalizeApiFootballFixture", () => {
  test("returns normalized updates when optional event data is missing", () => {
    expect(
      normalizeApiFootballFixture({
        fixture: {
          id: 8675309,
          date: "2026-06-14T17:00:00+00:00",
          status: {
            short: "FT"
          }
        },
        goals: {
          home: 2,
          away: 1
        },
        score: {
          halftime: {
            home: null,
            away: null
          }
        },
        events: []
      })
    ).toEqual({
      apiMatchId: "8675309",
      status: "final",
      homeScore: 2,
      awayScore: 1,
      winner: "home",
      homeHalftimeScore: null,
      awayHalftimeScore: null,
      firstScoringTeamExternalId: null,
      lastScoringTeamExternalId: null,
      kickoffAt: "2026-06-14T17:00:00.000Z"
    });
  });

  test("extracts first and last scoring teams from goal events", () => {
    expect(
      normalizeApiFootballFixture({
        fixture: {
          id: 123,
          date: "2026-06-14T17:00:00+00:00",
          status: {
            short: "FT"
          }
        },
        goals: {
          home: 2,
          away: 2
        },
        score: {
          halftime: {
            home: 1,
            away: 1
          }
        },
        events: [
          { type: "Goal", team: { id: 44 } },
          { type: "Card", team: { id: 55 } },
          { type: "Goal", team: { id: 55 } }
        ]
      })
    ).toMatchObject({
      apiMatchId: "123",
      status: "final",
      winner: "draw",
      homeHalftimeScore: 1,
      awayHalftimeScore: 1,
      firstScoringTeamExternalId: "44",
      lastScoringTeamExternalId: "55"
    });
  });
});

describe("createApiFootballProvider", () => {
  test("fetches fixture updates by provider match id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: [
          {
            fixture: {
              id: 123,
              date: "2026-06-14T17:00:00+00:00",
              status: {
                short: "1H"
              }
            },
            goals: {
              home: 1,
              away: 0
            },
            score: {
              halftime: {
                home: null,
                away: null
              }
            },
            events: []
          }
        ]
      })
    });

    const provider = createApiFootballProvider({
      apiKey: "test-key",
      baseUrl: "https://v3.football.api-sports.io",
      fetchImpl
    });

    await expect(provider.fetchUpdates(["123"])).resolves.toEqual([
      expect.objectContaining({
        apiMatchId: "123",
        status: "live",
        homeScore: 1,
        awayScore: 0
      })
    ]);

    expect(fetchImpl).toHaveBeenCalledWith("https://v3.football.api-sports.io/fixtures?id=123", {
      headers: {
        "x-apisports-key": "test-key"
      }
    });
  });
});
