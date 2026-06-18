import type { AppMatch, AppTeam } from "@/features/matches/data";

export type TeamTournamentSummary = {
  draws: number;
  goalDifference: number;
  losses: number;
  played: number;
  points: number;
  wins: number;
};

export type TeamComparison = {
  awaySummary: TeamTournamentSummary;
  homeSummary: TeamTournamentSummary;
  rankingGap: number | null;
  rankingLeader: AppTeam | null;
};

const FIFA_RANK_BY_CODE: Record<string, number> = {
  ALG: 36,
  ARG: 3,
  AUS: 26,
  AUT: 25,
  BEL: 8,
  CIV: 40,
  COD: 60,
  CPV: 67,
  CRO: 10,
  CUW: 73,
  ECU: 24,
  EGY: 32,
  ENG: 4,
  ESP: 2,
  FRA: 1,
  GER: 9,
  HAI: 83,
  IRN: 20,
  IRQ: 56,
  JOR: 66,
  JPN: 18,
  KSA: 58,
  NED: 7,
  NOR: 33,
  NZL: 89,
  POR: 6,
  SCO: 39,
  SEN: 19,
  SWE: 28,
  TUN: 49,
  TUR: 27,
  URU: 15
};

export function enrichTeamRanking<T extends Pick<AppTeam, "shortCode">>(team: T): T & { fifaRank?: number } {
  return {
    ...team,
    fifaRank: getFifaRank(team)
  };
}

export function getFifaRank(team: Pick<AppTeam, "shortCode">): number | undefined {
  return FIFA_RANK_BY_CODE[team.shortCode.toUpperCase()];
}

export function buildTeamComparison(match: AppMatch, matches: AppMatch[]): TeamComparison {
  const homeRank = getFifaRank(match.homeTeam);
  const awayRank = getFifaRank(match.awayTeam);
  const rankingGap = homeRank && awayRank ? Math.abs(homeRank - awayRank) : null;
  const rankingLeader = homeRank && awayRank
    ? homeRank < awayRank ? match.homeTeam : match.awayTeam
    : null;

  return {
    awaySummary: summarizeTournamentTeam(match.awayTeam, matches),
    homeSummary: summarizeTournamentTeam(match.homeTeam, matches),
    rankingGap,
    rankingLeader
  };
}

function summarizeTournamentTeam(team: AppTeam, matches: AppMatch[]): TeamTournamentSummary {
  return matches.reduce<TeamTournamentSummary>((summary, match) => {
    if (match.status !== "final" || match.homeScore == null || match.awayScore == null) {
      return summary;
    }

    const isHome = match.homeTeam.id === team.id;
    const isAway = match.awayTeam.id === team.id;

    if (!isHome && !isAway) {
      return summary;
    }

    const goalsFor = isHome ? match.homeScore : match.awayScore;
    const goalsAgainst = isHome ? match.awayScore : match.homeScore;

    summary.played += 1;
    summary.goalDifference += goalsFor - goalsAgainst;

    if (goalsFor > goalsAgainst) {
      summary.wins += 1;
      summary.points += 3;
    } else if (goalsFor === goalsAgainst) {
      summary.draws += 1;
      summary.points += 1;
    } else {
      summary.losses += 1;
    }

    return summary;
  }, { draws: 0, goalDifference: 0, losses: 0, played: 0, points: 0, wins: 0 });
}
