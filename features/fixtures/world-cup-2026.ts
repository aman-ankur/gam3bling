export type FixtureTeam = {
  id: string;
  name: string;
  shortCode: string;
  flagCode?: string;
};

export type FixtureMatch = {
  id: string;
  apiMatchId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  stage: string;
  groupName: string;
  status: "scheduled" | "live" | "halftime" | "final" | "postponed";
};

export const tournament = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "FIFA World Cup 2026",
  sport: "football",
  season: "2026",
  status: "active"
} as const;

export const teams: FixtureTeam[] = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Germany", shortCode: "GER", flagCode: "DE" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Curacao", shortCode: "CUW", flagCode: "CW" },
  { id: "20000000-0000-4000-8000-000000000003", name: "Netherlands", shortCode: "NED", flagCode: "NL" },
  { id: "20000000-0000-4000-8000-000000000004", name: "Japan", shortCode: "JPN", flagCode: "JP" },
  { id: "20000000-0000-4000-8000-000000000005", name: "Ivory Coast", shortCode: "CIV", flagCode: "CI" },
  { id: "20000000-0000-4000-8000-000000000006", name: "Ecuador", shortCode: "ECU", flagCode: "EC" },
  { id: "20000000-0000-4000-8000-000000000007", name: "Sweden", shortCode: "SWE", flagCode: "SE" },
  { id: "20000000-0000-4000-8000-000000000008", name: "Tunisia", shortCode: "TUN", flagCode: "TN" },
  { id: "20000000-0000-4000-8000-000000000009", name: "Spain", shortCode: "ESP", flagCode: "ES" },
  { id: "20000000-0000-4000-8000-000000000010", name: "Cape Verde", shortCode: "CPV", flagCode: "CV" },
  { id: "20000000-0000-4000-8000-000000000011", name: "Belgium", shortCode: "BEL", flagCode: "BE" },
  { id: "20000000-0000-4000-8000-000000000012", name: "Egypt", shortCode: "EGY", flagCode: "EG" },
  { id: "20000000-0000-4000-8000-000000000013", name: "Saudi Arabia", shortCode: "KSA", flagCode: "SA" },
  { id: "20000000-0000-4000-8000-000000000014", name: "Uruguay", shortCode: "URU", flagCode: "UY" },
  { id: "20000000-0000-4000-8000-000000000015", name: "Iran", shortCode: "IRN", flagCode: "IR" },
  { id: "20000000-0000-4000-8000-000000000016", name: "New Zealand", shortCode: "NZL", flagCode: "NZ" },
  { id: "20000000-0000-4000-8000-000000000017", name: "France", shortCode: "FRA", flagCode: "FR" },
  { id: "20000000-0000-4000-8000-000000000018", name: "Senegal", shortCode: "SEN", flagCode: "SN" },
  { id: "20000000-0000-4000-8000-000000000019", name: "Iraq", shortCode: "IRQ", flagCode: "IQ" },
  { id: "20000000-0000-4000-8000-000000000020", name: "Norway", shortCode: "NOR", flagCode: "NO" },
  { id: "20000000-0000-4000-8000-000000000021", name: "Argentina", shortCode: "ARG", flagCode: "AR" },
  { id: "20000000-0000-4000-8000-000000000022", name: "Algeria", shortCode: "ALG", flagCode: "DZ" },
  { id: "20000000-0000-4000-8000-000000000023", name: "Austria", shortCode: "AUT", flagCode: "AT" },
  { id: "20000000-0000-4000-8000-000000000024", name: "Jordan", shortCode: "JOR", flagCode: "JO" },
  { id: "20000000-0000-4000-8000-000000000025", name: "Portugal", shortCode: "POR", flagCode: "PT" },
  { id: "20000000-0000-4000-8000-000000000026", name: "DR Congo", shortCode: "COD", flagCode: "CD" },
  { id: "20000000-0000-4000-8000-000000000027", name: "England", shortCode: "ENG", flagCode: "GB-ENG" },
  { id: "20000000-0000-4000-8000-000000000028", name: "Croatia", shortCode: "CRO", flagCode: "HR" },
  { id: "20000000-0000-4000-8000-000000000029", name: "Haiti", shortCode: "HAI", flagCode: "HT" },
  { id: "20000000-0000-4000-8000-000000000030", name: "Scotland", shortCode: "SCO", flagCode: "GB-SCT" },
  { id: "20000000-0000-4000-8000-000000000031", name: "Australia", shortCode: "AUS", flagCode: "AU" },
  { id: "20000000-0000-4000-8000-000000000032", name: "Turkiye", shortCode: "TUR", flagCode: "TR" }
];

export const matches: FixtureMatch[] = [
  match("30000000-0000-4000-8000-000000000015", "1489372", "HAI", "SCO", "2026-06-14T01:00:00Z", "Group C", "C"),
  match("30000000-0000-4000-8000-000000000016", "1539001", "AUS", "TUR", "2026-06-14T04:00:00Z", "Group D", "D"),
  match("30000000-0000-4000-8000-000000000001", "1489374", "GER", "CUW", "2026-06-14T17:00:00Z", "Group E", "E"),
  match("30000000-0000-4000-8000-000000000002", "1489376", "NED", "JPN", "2026-06-14T20:00:00Z", "Group F", "F"),
  match("30000000-0000-4000-8000-000000000003", "1489375", "CIV", "ECU", "2026-06-14T23:00:00Z", "Group E", "E"),
  match("30000000-0000-4000-8000-000000000004", "1539002", "SWE", "TUN", "2026-06-15T02:00:00Z", "Group F", "F"),
  match("30000000-0000-4000-8000-000000000005", "1489380", "ESP", "CPV", "2026-06-15T16:00:00Z", "Group H", "H"),
  match("30000000-0000-4000-8000-000000000006", "1489377", "BEL", "EGY", "2026-06-15T19:00:00Z", "Group G", "G"),
  match("30000000-0000-4000-8000-000000000007", "1489379", "KSA", "URU", "2026-06-15T22:00:00Z", "Group H", "H"),
  match("30000000-0000-4000-8000-000000000008", "wc2026-irn-nzl", "IRN", "NZL", "2026-06-16T01:00:00Z", "Group G", "G"),
  match("30000000-0000-4000-8000-000000000009", "wc2026-fra-sen", "FRA", "SEN", "2026-06-16T19:00:00Z", "Group I", "I"),
  match("30000000-0000-4000-8000-000000000010", "wc2026-irq-nor", "IRQ", "NOR", "2026-06-16T22:00:00Z", "Group I", "I"),
  match("30000000-0000-4000-8000-000000000011", "wc2026-arg-alg", "ARG", "ALG", "2026-06-17T01:00:00Z", "Group J", "J"),
  match("30000000-0000-4000-8000-000000000012", "wc2026-aut-jor", "AUT", "JOR", "2026-06-17T04:00:00Z", "Group J", "J"),
  match("30000000-0000-4000-8000-000000000013", "wc2026-por-cod", "POR", "COD", "2026-06-17T17:00:00Z", "Group K", "K"),
  match("30000000-0000-4000-8000-000000000014", "wc2026-eng-cro", "ENG", "CRO", "2026-06-17T20:00:00Z", "Group L", "L")
];

export const teamById = new Map(teams.map((team) => [team.id, team]));

function match(
  id: string,
  apiMatchId: string,
  homeCode: string,
  awayCode: string,
  kickoffAt: string,
  stage: string,
  groupName: string
): FixtureMatch {
  return {
    id,
    apiMatchId,
    homeTeamId: teamIdFromCode(homeCode),
    awayTeamId: teamIdFromCode(awayCode),
    kickoffAt,
    stage,
    groupName,
    status: "scheduled"
  };
}

function teamIdFromCode(shortCode: string): string {
  const team = teams.find((candidate) => candidate.shortCode === shortCode);

  if (!team) {
    throw new Error(`Unknown team code ${shortCode}`);
  }

  return team.id;
}
