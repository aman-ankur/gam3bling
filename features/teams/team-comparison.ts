import type { AppMatch, AppTeam } from "@/features/matches/data";

export type TeamProfile = {
  confederation: string;
  fifaRank: number;
  rankingSource: string;
  rankingUpdatedLabel: string;
  worldCupBest: string;
};

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
  awayProfile: TeamProfile | null;
  homeSummary: TeamTournamentSummary;
  homeProfile: TeamProfile | null;
  rankingGap: number | null;
  rankingLeader: AppTeam | null;
};

const RANKING_SOURCE = "Seeded team profile";
const RANKING_UPDATED_LABEL = "Ready before kickoff";

const TEAM_PROFILE_BY_CODE: Record<string, TeamProfile> = {
  ALG: profile(36, "CAF", "Group stage"),
  ARG: profile(3, "CONMEBOL", "Winners"),
  AUS: profile(26, "AFC", "Round of 16"),
  AUT: profile(25, "UEFA", "Third place"),
  BEL: profile(8, "UEFA", "Third place"),
  CIV: profile(40, "CAF", "Group stage"),
  COD: profile(60, "CAF", "Group stage"),
  COL: profile(13, "CONMEBOL", "Quarterfinals"),
  CPV: profile(67, "CAF", "Debut"),
  CRO: profile(10, "UEFA", "Runners-up"),
  CUW: profile(73, "CONCACAF", "Debut"),
  ECU: profile(24, "CONMEBOL", "Round of 16"),
  EGY: profile(32, "CAF", "Group stage"),
  ENG: profile(4, "UEFA", "Winners"),
  ESP: profile(2, "UEFA", "Winners"),
  FRA: profile(1, "UEFA", "Winners"),
  GER: profile(9, "UEFA", "Winners"),
  GHA: profile(76, "CAF", "Quarterfinals"),
  HAI: profile(83, "CONCACAF", "Group stage"),
  IRN: profile(20, "AFC", "Group stage"),
  IRQ: profile(56, "AFC", "Group stage"),
  JOR: profile(66, "AFC", "Debut"),
  JPN: profile(18, "AFC", "Round of 16"),
  KSA: profile(58, "AFC", "Round of 16"),
  NED: profile(7, "UEFA", "Runners-up"),
  NOR: profile(33, "UEFA", "Round of 16"),
  NZL: profile(89, "OFC", "Group stage"),
  PAN: profile(30, "CONCACAF", "Group stage"),
  POR: profile(6, "UEFA", "Third place"),
  SCO: profile(39, "UEFA", "Group stage"),
  SEN: profile(19, "CAF", "Quarterfinals"),
  SWE: profile(28, "UEFA", "Runners-up"),
  TUN: profile(49, "CAF", "Group stage"),
  TUR: profile(27, "UEFA", "Third place"),
  URU: profile(15, "CONMEBOL", "Winners"),
  UZB: profile(57, "AFC", "Debut")
};

export function enrichTeamRanking<T extends Pick<AppTeam, "shortCode">>(team: T): T & { fifaRank?: number } {
  const profile = getTeamProfile(team);

  return {
    ...team,
    fifaRank: profile?.fifaRank
  };
}

export function getFifaRank(team: Pick<AppTeam, "shortCode">): number | undefined {
  return getTeamProfile(team)?.fifaRank;
}

export function getTeamProfile(team: Pick<AppTeam, "shortCode">): TeamProfile | null {
  return TEAM_PROFILE_BY_CODE[team.shortCode.toUpperCase()] ?? null;
}

export function formatMatchRankingLabel(homeTeam: Pick<AppTeam, "shortCode">, awayTeam: Pick<AppTeam, "shortCode">): string {
  return `FIFA rank ${rankLabel(getFifaRank(homeTeam))} / ${rankLabel(getFifaRank(awayTeam))}`;
}

export function buildTeamComparison(match: AppMatch, matches: AppMatch[]): TeamComparison {
  const homeProfile = getTeamProfile(match.homeTeam);
  const awayProfile = getTeamProfile(match.awayTeam);
  const homeRank = homeProfile?.fifaRank;
  const awayRank = awayProfile?.fifaRank;
  const rankingGap = homeRank && awayRank ? Math.abs(homeRank - awayRank) : null;
  const rankingLeader = homeRank && awayRank
    ? homeRank < awayRank ? match.homeTeam : match.awayTeam
    : null;

  return {
    awayProfile,
    awaySummary: summarizeTournamentTeam(match.awayTeam, matches),
    homeProfile,
    homeSummary: summarizeTournamentTeam(match.homeTeam, matches),
    rankingGap,
    rankingLeader
  };
}

function profile(fifaRank: number, confederation: string, worldCupBest: string): TeamProfile {
  return {
    confederation,
    fifaRank,
    rankingSource: RANKING_SOURCE,
    rankingUpdatedLabel: RANKING_UPDATED_LABEL,
    worldCupBest
  };
}

function rankLabel(rank: number | null | undefined): string {
  return rank ? `#${rank}` : "Rank pending";
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
