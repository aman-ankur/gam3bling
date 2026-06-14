export type MatchStatus = "scheduled" | "live" | "halftime" | "final" | "postponed";

export type MatchResult = "home" | "away" | "draw";

export type TournamentSeed = {
  name: string;
  sport: "football";
  season: string;
  status: "planned" | "active" | "completed";
  theme: Record<string, string>;
};

export type TeamSeed = {
  name: string;
  shortCode: string;
  flagCode?: string;
  crestUrl?: string;
};

export type MatchSeed = {
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffAt: string;
  stage: string;
  groupName?: string;
  status: MatchStatus;
  apiProvider?: string;
  apiMatchId?: string;
};

export type WorldCupSampleSeed = {
  tournament: TournamentSeed;
  teams: TeamSeed[];
  matches: MatchSeed[];
};
