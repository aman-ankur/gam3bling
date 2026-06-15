import type { AppTeam } from "@/features/matches/data";

type TeamDisplay = {
  flagCode?: string | null;
  name: string;
  shortCode?: string | null;
};

type TeamNameProps = {
  className?: string;
  team: TeamDisplay;
};

type MatchupNameProps = {
  awayTeam: TeamDisplay;
  className?: string;
  homeTeam: TeamDisplay;
};

export function TeamName({ className, team }: TeamNameProps) {
  const flag = flagGlyph(team.flagCode, team.shortCode);

  return (
    <span className={["team-name", className].filter(Boolean).join(" ")}>
      <span aria-label={`${team.name} flag`} className="team-flag" data-flag={flag} role="img" />
      <span>{team.name}</span>
    </span>
  );
}

export function MatchupName({ awayTeam, className, homeTeam }: MatchupNameProps) {
  return (
    <span aria-label={`${homeTeam.name} vs ${awayTeam.name}`} className={["matchup-name", className].filter(Boolean).join(" ")}>
      <TeamName team={homeTeam} />
      <span className="matchup-vs"> vs </span>
      <TeamName team={awayTeam} />
    </span>
  );
}

export function teamLabel(team: Pick<AppTeam, "name">): string {
  return team.name;
}

function flagGlyph(flagCode: string | null | undefined, fallback: string | null | undefined): string {
  if (flagCode && /^[A-Z]{2}$/.test(flagCode)) {
    return String.fromCodePoint(...[...flagCode].map((letter) => 127397 + letter.charCodeAt(0)));
  }

  return fallback?.slice(0, 3).toUpperCase() ?? "??";
}
