type TeamIdentity = {
  id: string;
  name: string;
};

const TEAM_NAME_ALIASES: Record<string, string> = {
  "cote d ivoire": "ivory coast",
  "cote divoire": "ivory coast",
  "côte d ivoire": "ivory coast",
  "côte divoire": "ivory coast",
  "congo dr": "dr congo",
  "congo democratic republic": "dr congo",
  "democratic republic congo": "dr congo",
  "democratic republic of congo": "dr congo",
  "d r congo": "dr congo",
  "turkey": "turkiye",
  "türkiye": "turkiye"
};

export function resolveLocalTeamIdFromProviderName({
  awayTeam,
  homeTeam,
  providerTeamName
}: {
  awayTeam: TeamIdentity;
  homeTeam: TeamIdentity;
  providerTeamName: string;
}): string | null {
  const normalized = canonicalTeamName(providerTeamName);

  if (normalized === canonicalTeamName(homeTeam.name)) {
    return homeTeam.id;
  }

  if (normalized === canonicalTeamName(awayTeam.name)) {
    return awayTeam.id;
  }

  return null;
}

function canonicalTeamName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return TEAM_NAME_ALIASES[normalized] ?? normalized;
}
