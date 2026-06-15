import { describe, expect, test, vi } from "vitest";
import {
  createApiFootballProvider,
  normalizeApiFootballFixture,
  normalizeApiFootballLineups,
  normalizeApiFootballStatistics,
  normalizeApiFootballStatus
} from "./api-football-provider";
import {
  createEpsnProvider,
  normalizeEpsnScoreboardEvent,
  normalizeEpsnSummary
} from "./espn-provider";
import { createFallbackFootballProvider } from "./fallback-provider";

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
        teams: {
          home: { id: 44 },
          away: { id: 55 }
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
      homeTeamExternalId: "44",
      awayTeamExternalId: "55",
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
        teams: {
          home: { id: 44 },
          away: { id: 55 }
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
      homeTeamExternalId: "44",
      awayTeamExternalId: "55",
      homeHalftimeScore: 1,
      awayHalftimeScore: 1,
      firstScoringTeamExternalId: "44",
      lastScoringTeamExternalId: "55"
    });
  });

  test("ignores missed penalties when extracting scoring teams", () => {
    expect(
      normalizeApiFootballFixture({
        fixture: {
          id: 456,
          date: "2026-06-14T17:00:00+00:00",
          status: {
            short: "FT"
          }
        },
        goals: {
          home: 1,
          away: 0
        },
        teams: {
          home: { id: 44 },
          away: { id: 55 }
        },
        score: {
          halftime: {
            home: 0,
            away: 0
          }
        },
        events: [
          { type: "Goal", detail: "Missed Penalty", team: { id: 55 } },
          { type: "Goal", detail: "Normal Goal", team: { id: 44 } }
        ]
      })
    ).toMatchObject({
      apiMatchId: "456",
      firstScoringTeamExternalId: "44",
      lastScoringTeamExternalId: "44"
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

  test("fetches fixture lineups and statistics by provider match id", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: [
            {
              team: { id: 111, name: "Netherlands" },
              coach: { name: "Ronald Koeman" },
              formation: "4-2-3-1",
              startXI: [
                { player: { id: 1, name: "Bart Verbruggen", number: 1, pos: "G", grid: "1:1" } }
              ],
              substitutes: [
                { player: { id: 12, name: "Justin Bijlow", number: 13, pos: "G", grid: null } }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: [
            {
              team: { id: 111, name: "Netherlands" },
              statistics: [
                { type: "Ball Possession", value: "58%" },
                { type: "Total Shots", value: 13 }
              ]
            }
          ]
        })
      });

    const provider = createApiFootballProvider({
      apiKey: "test-key",
      baseUrl: "https://v3.football.api-sports.io",
      fetchImpl
    });

    await expect(provider.fetchMatchDetails("123")).resolves.toEqual({
      apiMatchId: "123",
      lineupsStatus: "available",
      statisticsStatus: "available",
      lineups: [
        {
          providerTeamId: "111",
          teamName: "Netherlands",
          coachName: "Ronald Koeman",
          formation: "4-2-3-1",
          players: [
            {
              providerPlayerId: "1",
              playerName: "Bart Verbruggen",
              shirtNumber: 1,
              position: "G",
              grid: "1:1",
              role: "starter",
              sortOrder: 0
            },
            {
              providerPlayerId: "12",
              playerName: "Justin Bijlow",
              shirtNumber: 13,
              position: "G",
              grid: null,
              role: "substitute",
              sortOrder: 1
            }
          ]
        }
      ],
      statistics: [
        { providerTeamId: "111", teamName: "Netherlands", statName: "Ball Possession", statValue: "58%", sortOrder: 0 },
        { providerTeamId: "111", teamName: "Netherlands", statName: "Total Shots", statValue: "13", sortOrder: 1 }
      ],
      rawPayload: expect.objectContaining({
        lineups: expect.any(Array),
        statistics: expect.any(Array)
      })
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://v3.football.api-sports.io/fixtures/lineups?fixture=123", {
      headers: {
        "x-apisports-key": "test-key"
      }
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://v3.football.api-sports.io/fixtures/statistics?fixture=123", {
      headers: {
        "x-apisports-key": "test-key"
      }
    });
  });

  test("includes provider access errors in match detail failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: {
          access: "Your account is suspended, check on https://dashboard.api-football.com."
        },
        response: []
      })
    });
    const provider = createApiFootballProvider({
      apiKey: "test-key",
      baseUrl: "https://v3.football.api-sports.io",
      fetchImpl
    });

    await expect(provider.fetchMatchDetails("123")).rejects.toThrow(
      "API-FOOTBALL returned errors: access: Your account is suspended, check on https://dashboard.api-football.com."
    );
  });
});

describe("normalizeApiFootballLineups", () => {
  test("normalizes starters and substitutes", () => {
    expect(
      normalizeApiFootballLineups([
        {
          team: { id: 111, name: "Netherlands" },
          coach: { name: "Ronald Koeman" },
          formation: "4-3-3",
          startXI: [
            { player: { id: 8, name: "Cody Gakpo", number: 11, pos: "F", grid: "4:1" } }
          ],
          substitutes: [
            { player: { id: 9, name: "Wout Weghorst", number: 19, pos: "F" } }
          ]
        }
      ])
    ).toEqual([
      {
        providerTeamId: "111",
        teamName: "Netherlands",
        coachName: "Ronald Koeman",
        formation: "4-3-3",
        players: [
          {
            providerPlayerId: "8",
            playerName: "Cody Gakpo",
            shirtNumber: 11,
            position: "F",
            grid: "4:1",
            role: "starter",
            sortOrder: 0
          },
          {
            providerPlayerId: "9",
            playerName: "Wout Weghorst",
            shirtNumber: 19,
            position: "F",
            grid: null,
            role: "substitute",
            sortOrder: 1
          }
        ]
      }
    ]);
  });
});

describe("normalizeApiFootballStatistics", () => {
  test("normalizes team statistics as display strings", () => {
    expect(
      normalizeApiFootballStatistics([
        {
          team: { id: 111, name: "Netherlands" },
          statistics: [
            { type: "Ball Possession", value: "58%" },
            { type: "Total Shots", value: 13 },
            { type: "Expected Goals", value: null }
          ]
        }
      ])
    ).toEqual([
      { providerTeamId: "111", teamName: "Netherlands", statName: "Ball Possession", statValue: "58%", sortOrder: 0 },
      { providerTeamId: "111", teamName: "Netherlands", statName: "Total Shots", statValue: "13", sortOrder: 1 },
      { providerTeamId: "111", teamName: "Netherlands", statName: "Expected Goals", statValue: null, sortOrder: 2 }
    ]);
  });
});

describe("normalizeEpsnScoreboardEvent", () => {
  test("maps ESPN live scoreboard events to provider match updates", () => {
    const update = normalizeEpsnScoreboardEvent(
      {
        id: "760421",
        date: "2026-06-14T04:00Z",
        status: {
          type: {
            state: "in",
            completed: false,
            description: "Second Half",
            name: "STATUS_SECOND_HALF"
          }
        },
        competitions: [
          {
            competitors: [
              {
                homeAway: "home",
                score: "2",
                team: {
                  id: "628",
                  displayName: "Australia",
                  abbreviation: "AUS"
                }
              },
              {
                homeAway: "away",
                score: "0",
                team: {
                  id: "465",
                  displayName: "Turkiye",
                  abbreviation: "TUR"
                }
              }
            ]
          }
        ]
      },
      {
        localMatchId: "match-1",
        apiProvider: "api-football",
        apiMatchId: "1539001",
        kickoffAt: "2026-06-14T04:00:00.000Z",
        homeTeam: { id: "team-home", name: "Australia", shortCode: "AUS" },
        awayTeam: { id: "team-away", name: "Turkiye", shortCode: "TUR" }
      }
    );

    expect(update).toEqual({
      localMatchId: "match-1",
      apiMatchId: "760421",
      status: "live",
      homeScore: 2,
      awayScore: 0,
      homeTeamExternalId: "628",
      awayTeamExternalId: "465",
      winner: "home",
      homeHalftimeScore: null,
      awayHalftimeScore: null,
      firstScoringTeamExternalId: null,
      lastScoringTeamExternalId: null,
      kickoffAt: "2026-06-14T04:00:00.000Z"
    });
  });
});

describe("createEpsnProvider", () => {
  test("enriches score updates with halftime and scorer teams from summary events", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "760421",
              date: "2026-06-14T04:00Z",
              status: { type: { state: "post", completed: true, description: "Full Time" } },
              competitions: [
                {
                  competitors: [
                    { homeAway: "home", score: "2", team: { id: "628", displayName: "Australia", abbreviation: "AUS" } },
                    { homeAway: "away", score: "0", team: { id: "465", displayName: "Turkiye", abbreviation: "TUR" } }
                  ]
                }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keyEvents: [
            { scoringPlay: true, period: { number: 1 }, team: { id: "628" }, type: { type: "goal" } },
            { scoringPlay: true, period: { number: 2 }, team: { id: "628" }, type: { type: "goal" } }
          ]
        })
      });
    const provider = createEpsnProvider({ baseUrl: "https://espn.test", fetchImpl });

    await expect(provider.fetchUpdates([
      {
        localMatchId: "match-1",
        apiProvider: "api-football",
        apiMatchId: "1539001",
        kickoffAt: "2026-06-14T04:00:00.000Z",
        homeTeam: { id: "team-home", name: "Australia", shortCode: "AUS" },
        awayTeam: { id: "team-away", name: "Turkiye", shortCode: "TUR" }
      }
    ])).resolves.toEqual([
      expect.objectContaining({
        localMatchId: "match-1",
        apiMatchId: "760421",
        status: "final",
        homeScore: 2,
        awayScore: 0,
        homeHalftimeScore: 1,
        awayHalftimeScore: 0,
        firstScoringTeamExternalId: "628",
        lastScoringTeamExternalId: "628"
      })
    ]);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://espn.test/scoreboard?dates=20260614&limit=100");
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://espn.test/summary?event=760421");
  });
});

describe("normalizeEpsnSummary", () => {
  test("normalizes ESPN rosters, statistics, and scoring events", () => {
    const details = normalizeEpsnSummary("760421", {
      header: {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { id: "628", displayName: "Australia", abbreviation: "AUS" }, score: "2" },
              { homeAway: "away", team: { id: "465", displayName: "Turkiye", abbreviation: "TUR" }, score: "0" }
            ]
          }
        ]
      },
      rosters: [
        {
          homeAway: "home",
          team: { id: "628", displayName: "Australia" },
          roster: [
            {
              starter: true,
              jersey: "18",
              formationPlace: "1",
              athlete: { id: "335240", displayName: "Patrick Beach" },
              position: { abbreviation: "G" }
            },
            {
              starter: false,
              jersey: "10",
              athlete: { id: "123", displayName: "Sub Player" },
              position: { abbreviation: "F" }
            }
          ]
        },
        {
          homeAway: "away",
          team: { id: "465", displayName: "Turkiye" },
          roster: [
            {
              starter: true,
              jersey: "23",
              formationPlace: "1",
              athlete: { id: "444", displayName: "Ugurcan Cakir" },
              position: { abbreviation: "G" }
            }
          ]
        }
      ],
      boxscore: {
        teams: [
          {
            team: { id: "628", displayName: "Australia" },
            statistics: [
              { label: "Possession", displayValue: "28.4" },
              { label: "Shots", displayValue: "9" }
            ]
          },
          {
            team: { id: "465", displayName: "Turkiye" },
            statistics: [
              { label: "Possession", displayValue: "71.6" }
            ]
          }
        ]
      },
      keyEvents: [
        { scoringPlay: true, period: { number: 1 }, team: { id: "628" }, type: { type: "goal" } },
        { scoringPlay: true, period: { number: 2 }, team: { id: "628" }, type: { type: "goal" } }
      ]
    });

    expect(details).toEqual({
      apiMatchId: "760421",
      lineupsStatus: "available",
      statisticsStatus: "available",
      lineups: [
        {
          providerTeamId: "628",
          teamName: "Australia",
          formation: null,
          coachName: null,
          players: [
            {
              providerPlayerId: "335240",
              playerName: "Patrick Beach",
              shirtNumber: 18,
              position: "G",
              grid: "1",
              role: "starter",
              sortOrder: 0
            },
            {
              providerPlayerId: "123",
              playerName: "Sub Player",
              shirtNumber: 10,
              position: "F",
              grid: null,
              role: "substitute",
              sortOrder: 1
            }
          ]
        },
        {
          providerTeamId: "465",
          teamName: "Turkiye",
          formation: null,
          coachName: null,
          players: [
            {
              providerPlayerId: "444",
              playerName: "Ugurcan Cakir",
              shirtNumber: 23,
              position: "G",
              grid: "1",
              role: "starter",
              sortOrder: 0
            }
          ]
        }
      ],
      statistics: [
        { providerTeamId: "628", teamName: "Australia", statName: "Possession", statValue: "28.4", sortOrder: 0 },
        { providerTeamId: "628", teamName: "Australia", statName: "Shots", statValue: "9", sortOrder: 1 },
        { providerTeamId: "465", teamName: "Turkiye", statName: "Possession", statValue: "71.6", sortOrder: 0 }
      ],
      rawPayload: {
        lineups: expect.any(Array),
        statistics: expect.any(Array)
      }
    });
  });
});

describe("createFallbackFootballProvider", () => {
  test("uses the next provider when the first provider fails", async () => {
    const match = {
      localMatchId: "match-1",
      apiProvider: "api-football",
      apiMatchId: "123",
      kickoffAt: "2026-06-14T04:00:00.000Z",
      homeTeam: { id: "team-home", name: "Australia", shortCode: "AUS" },
      awayTeam: { id: "team-away", name: "Turkiye", shortCode: "TUR" }
    };
    const primary = {
      name: "api-football",
      fetchUpdates: vi.fn().mockRejectedValue(new Error("account suspended")),
      fetchMatchDetails: vi.fn()
    };
    const backup = {
      name: "espn",
      fetchUpdates: vi.fn().mockResolvedValue([
        {
          localMatchId: "match-1",
          apiMatchId: "760421",
          status: "final",
          homeScore: 2,
          awayScore: 0
        }
      ]),
      fetchMatchDetails: vi.fn()
    };
    const provider = createFallbackFootballProvider([primary, backup]);

    await expect(provider.fetchUpdates([match])).resolves.toEqual([
      {
        localMatchId: "match-1",
        apiMatchId: "760421",
        status: "final",
        homeScore: 2,
        awayScore: 0
      }
    ]);
    expect(primary.fetchUpdates).toHaveBeenCalledWith([match]);
    expect(backup.fetchUpdates).toHaveBeenCalledWith([match]);
  });
});
