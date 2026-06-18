import { describe, expect, it } from "vitest";
import { teams } from "@/features/fixtures/world-cup-2026";
import type { AppMatch, AppTeam } from "@/features/matches/data";
import { buildTeamComparison, enrichTeamRanking, formatMatchRankingLabel, getTeamProfile } from "@/features/teams/team-comparison";

describe("team comparison profiles", () => {
  it("covers every seeded World Cup fixture team", () => {
    const missingProfiles = teams
      .filter((team) => !getTeamProfile(team))
      .map((team) => team.shortCode);

    expect(missingProfiles).toEqual([]);
  });

  it("covers production synced ESPN team codes", () => {
    const productionCodes = ["BIH", "BRA", "CAN", "CZE", "KOR", "MAR", "MEX", "PAR", "QAT", "RSA", "SUI", "USA"];
    const missingProfiles = productionCodes.filter((shortCode) => !getTeamProfile({ shortCode }));

    expect(missingProfiles).toEqual([]);
  });

  it("builds comparison details for future fixtures without missing ranks", () => {
    const match = fixtureMatch("GHA", "PAN");
    const comparison = buildTeamComparison(match, [match]);

    expect(formatMatchRankingLabel(match.homeTeam, match.awayTeam)).toBe("FIFA rank #76 / #30");

    expect(comparison.homeProfile?.worldCupBest).toBe("Quarterfinals");
    expect(comparison.awayProfile?.confederation).toBe("CONCACAF");
    expect(comparison.rankingGap).toBe(46);
  });
});

function fixtureMatch(homeCode: string, awayCode: string): AppMatch {
  return {
    apiMatchId: `${homeCode}-${awayCode}`,
    awayTeam: fixtureTeam(awayCode),
    groupName: "Group L",
    homeTeam: fixtureTeam(homeCode),
    id: `${homeCode}-${awayCode}`,
    kickoffAt: "2026-06-17T23:00:00Z",
    stage: "Group L",
    status: "scheduled"
  };
}

function fixtureTeam(shortCode: string): AppTeam {
  const team = teams.find((candidate) => candidate.shortCode === shortCode);

  if (!team) {
    throw new Error(`Missing fixture team ${shortCode}`);
  }

  return enrichTeamRanking(team);
}
