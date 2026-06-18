import "server-only";
import type { AppMatch } from "@/features/matches/data";
import type { TeamTournamentSummary, TeamTournamentSummaryByCode } from "./team-comparison";

type EpsnStandingEntry = {
  stats?: Array<{
    name?: string | null;
    value?: number | null;
  }> | null;
  team?: string | null;
};

type EpsnSummaryStandings = {
  standings?: {
    groups?: Array<{
      standings?: {
        entries?: EpsnStandingEntry[] | null;
      } | null;
    }> | null;
  } | null;
};

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

export async function getEpsnTournamentSummaryForMatch(match: AppMatch): Promise<TeamTournamentSummaryByCode> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1" || !match.apiMatchId || match.apiProvider === "demo") {
    return {};
  }

  try {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${encodeURIComponent(match.apiMatchId)}`, {
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return {};
    }

    const summary = await response.json() as EpsnSummaryStandings;
    const teamCodeByName = new Map([
      [normalizeTeamName(match.homeTeam.name), match.homeTeam.shortCode.toUpperCase()],
      [normalizeTeamName(match.awayTeam.name), match.awayTeam.shortCode.toUpperCase()]
    ]);
    const byCode: TeamTournamentSummaryByCode = {};

    for (const group of summary.standings?.groups ?? []) {
      for (const entry of group.standings?.entries ?? []) {
        const code = teamCodeByName.get(normalizeTeamName(entry.team));

        if (!code) {
          continue;
        }

        const parsed = summaryFromStats(entry.stats ?? []);

        if (parsed) {
          byCode[code] = parsed;
        }
      }
    }

    return byCode;
  } catch {
    return {};
  }
}

function normalizeTeamName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function statValue(stats: NonNullable<EpsnStandingEntry["stats"]>, name: string): number {
  const value = stats.find((stat) => stat.name === name)?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summaryFromStats(stats: NonNullable<EpsnStandingEntry["stats"]>): TeamTournamentSummary | null {
  const played = statValue(stats, "gamesPlayed");

  if (played <= 0) {
    return null;
  }

  return {
    draws: statValue(stats, "ties"),
    goalDifference: statValue(stats, "pointDifferential"),
    losses: statValue(stats, "losses"),
    played,
    points: statValue(stats, "points"),
    wins: statValue(stats, "wins")
  };
}
