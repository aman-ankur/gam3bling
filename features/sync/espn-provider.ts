import type {
  FootballProvider,
  ProviderLineup,
  ProviderLineupPlayer,
  ProviderMatchDetails,
  ProviderMatchQuery,
  ProviderMatchUpdate,
  ProviderTeamStatistic
} from "./provider";
import type { MatchResult, MatchStatus } from "../matches/types";

type FetchImpl = typeof fetch;

type EpsnProviderOptions = {
  baseUrl?: string;
  fetchImpl?: FetchImpl;
};

type EpsnTeam = {
  id?: string | number | null;
  displayName?: string | null;
  name?: string | null;
  abbreviation?: string | null;
};

type EpsnCompetitor = {
  homeAway?: string | null;
  score?: string | number | null;
  team?: EpsnTeam | null;
};

type EpsnStatusType = {
  state?: string | null;
  completed?: boolean | null;
  description?: string | null;
  name?: string | null;
  detail?: string | null;
  shortDetail?: string | null;
};

type EpsnScoreboardEvent = {
  id?: string | number | null;
  date?: string | null;
  status?: {
    type?: EpsnStatusType | null;
  } | null;
  competitions?: Array<{
    competitors?: EpsnCompetitor[];
  }>;
};

type EpsnScoreboardResponse = {
  events?: EpsnScoreboardEvent[];
};

type EpsnRosterPlayer = {
  starter?: boolean | null;
  jersey?: string | number | null;
  formationPlace?: string | number | null;
  athlete?: {
    id?: string | number | null;
    displayName?: string | null;
    fullName?: string | null;
  } | null;
  position?: {
    abbreviation?: string | null;
    displayName?: string | null;
    name?: string | null;
  } | null;
};

type EpsnSummary = {
  header?: {
    competitions?: Array<{
      competitors?: EpsnCompetitor[];
    }>;
  } | null;
  rosters?: Array<{
    homeAway?: string | null;
    team?: EpsnTeam | null;
    roster?: EpsnRosterPlayer[];
  }>;
  boxscore?: {
    teams?: Array<{
      team?: EpsnTeam | null;
      statistics?: Array<{
        label?: string | null;
        displayName?: string | null;
        name?: string | null;
        displayValue?: string | number | null;
      }>;
    }>;
  };
  keyEvents?: EpsnKeyEvent[];
};

type EpsnKeyEvent = {
  scoringPlay?: boolean | null;
  period?: {
    number?: number | null;
  } | null;
  team?: EpsnTeam | null;
  type?: {
    type?: string | null;
    text?: string | null;
  } | null;
};

const DEFAULT_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

export function createEpsnProvider(options: EpsnProviderOptions = {}): FootballProvider {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? process.env.ESPN_SOCCER_BASE_URL ?? DEFAULT_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "espn",
    async fetchUpdates(matches) {
      const queries = matches.flatMap(toProviderMatchQuery);
      const events = await fetchScoreboardEvents(fetchImpl, baseUrl, queries);

      const updates = await Promise.all(queries.map(async (query) => {
        const event = findEventForMatch(events, query);

        if (!event) {
          return null;
        }

        const update = normalizeEpsnScoreboardEvent(event, query);

        return {
          ...update,
          ...await fetchEpsnScoreContext(fetchImpl, baseUrl, update)
        };
      }));

      return updates.filter((update): update is ProviderMatchUpdate => Boolean(update));
    },
    async fetchMatchDetails(match) {
      const query = toProviderMatchQuery(match)[0];
      const eventId = query?.apiProvider === "espn" && query.apiMatchId ? query.apiMatchId : query
        ? valueToString(findEventForMatch(await fetchScoreboardEvents(fetchImpl, baseUrl, [query]), query)?.id)
        : typeof match === "string" ? match : null;

      if (!eventId) {
        throw new Error("ESPN match could not be resolved");
      }

      const response = await fetchImpl(`${baseUrl}/summary?event=${encodeURIComponent(eventId)}`);

      if (!response.ok) {
        throw new Error(`ESPN request failed with ${response.status}`);
      }

      return normalizeEpsnSummary(eventId, await response.json() as EpsnSummary);
    }
  };
}

async function fetchEpsnScoreContext(
  fetchImpl: FetchImpl,
  baseUrl: string,
  update: ProviderMatchUpdate
): Promise<Partial<ProviderMatchUpdate>> {
  try {
    const response = await fetchImpl(`${baseUrl}/summary?event=${encodeURIComponent(update.apiMatchId)}`);

    if (!response.ok) {
      return {};
    }

    return scoreContextFromSummary(await response.json() as EpsnSummary, update);
  } catch {
    return {};
  }
}

function scoreContextFromSummary(summary: EpsnSummary, update: ProviderMatchUpdate): Partial<ProviderMatchUpdate> {
  const scoringEvents = (summary.keyEvents ?? []).filter(isScoringGoalEvent);
  const scoringTeamIds = scoringEvents.map((event) => valueToString(event.team?.id)).filter((id): id is string => Boolean(id));
  const shouldResolveHalftime =
    update.status === "final"
    || update.status === "halftime"
    || (summary.keyEvents ?? []).some((event) => (event.period?.number ?? 0) > 1);

  return {
    homeHalftimeScore: shouldResolveHalftime
      ? scoringEvents.filter((event) => event.period?.number === 1 && valueToString(event.team?.id) === update.homeTeamExternalId).length
      : update.homeHalftimeScore,
    awayHalftimeScore: shouldResolveHalftime
      ? scoringEvents.filter((event) => event.period?.number === 1 && valueToString(event.team?.id) === update.awayTeamExternalId).length
      : update.awayHalftimeScore,
    firstScoringTeamExternalId: scoringTeamIds[0] ?? update.firstScoringTeamExternalId,
    lastScoringTeamExternalId: scoringTeamIds.at(-1) ?? update.lastScoringTeamExternalId
  };
}

function isScoringGoalEvent(event: EpsnKeyEvent): boolean {
  const type = `${event.type?.type ?? ""} ${event.type?.text ?? ""}`.toLowerCase();

  return Boolean(event.scoringPlay) && type.includes("goal") && event.team?.id != null;
}

export function normalizeEpsnScoreboardEvent(
  event: EpsnScoreboardEvent,
  query: ProviderMatchQuery
): ProviderMatchUpdate {
  const apiMatchId = valueToString(event.id);

  if (!apiMatchId) {
    throw new Error("ESPN event response is missing id");
  }

  const { home, away } = competitorsBySide(event.competitions?.[0]?.competitors ?? []);
  const homeScore = numberOrNull(home?.score);
  const awayScore = numberOrNull(away?.score);

  return {
    localMatchId: query.localMatchId,
    apiMatchId,
    status: normalizeEpsnStatus(event.status?.type),
    homeScore,
    awayScore,
    homeTeamExternalId: valueToString(home?.team?.id),
    awayTeamExternalId: valueToString(away?.team?.id),
    winner: winnerFromScore(homeScore, awayScore),
    homeHalftimeScore: null,
    awayHalftimeScore: null,
    firstScoringTeamExternalId: null,
    lastScoringTeamExternalId: null,
    kickoffAt: normalizeDate(event.date) ?? query.kickoffAt
  };
}

export function normalizeEpsnSummary(apiMatchId: string, summary: EpsnSummary): ProviderMatchDetails {
  const lineups = normalizeEpsnLineups(summary.rosters ?? []);
  const statistics = normalizeEpsnStatistics(summary.boxscore?.teams ?? []);

  return {
    apiMatchId,
    lineupsStatus: lineups.length > 0 ? "available" : "unavailable",
    statisticsStatus: statistics.length > 0 ? "available" : "unavailable",
    lineups,
    statistics,
    rawPayload: {
      lineups: summary.rosters ?? [],
      statistics: summary.boxscore?.teams ?? []
    }
  };
}

function normalizeEpsnLineups(rosters: NonNullable<EpsnSummary["rosters"]>): ProviderLineup[] {
  return rosters.flatMap((roster) => {
    const providerTeamId = valueToString(roster.team?.id);
    const teamName = roster.team?.displayName?.trim() || roster.team?.name?.trim();

    if (!providerTeamId || !teamName) {
      return [];
    }

    const starters: ProviderLineupPlayer[] = [];
    const substitutes: ProviderLineupPlayer[] = [];

    for (const player of roster.roster ?? []) {
      const normalized = normalizeEpsnLineupPlayer(player, starters.length + substitutes.length);

      if (!normalized) {
        continue;
      }

      if (normalized.role === "starter") {
        starters.push({ ...normalized, sortOrder: starters.length });
      } else {
        substitutes.push(normalized);
      }
    }

    return [{
      providerTeamId,
      teamName,
      formation: null,
      coachName: null,
      players: [
        ...starters,
        ...substitutes.map((player, index) => ({ ...player, sortOrder: starters.length + index }))
      ]
    }];
  });
}

function normalizeEpsnLineupPlayer(player: EpsnRosterPlayer, sortOrder: number): ProviderLineupPlayer | null {
  const playerName = player.athlete?.displayName?.trim() || player.athlete?.fullName?.trim();

  if (!playerName) {
    return null;
  }

  return {
    providerPlayerId: valueToString(player.athlete?.id),
    playerName,
    shirtNumber: numberOrNull(player.jersey),
    position: player.position?.abbreviation?.trim() || player.position?.displayName?.trim() || player.position?.name?.trim() || null,
    grid: player.formationPlace == null ? null : String(player.formationPlace),
    role: player.starter ? "starter" : "substitute",
    sortOrder
  };
}

function normalizeEpsnStatistics(teams: NonNullable<NonNullable<EpsnSummary["boxscore"]>["teams"]>): ProviderTeamStatistic[] {
  return teams.flatMap((teamStats) => {
    const providerTeamId = valueToString(teamStats.team?.id);
    const teamName = teamStats.team?.displayName?.trim() || teamStats.team?.name?.trim();

    if (!providerTeamId || !teamName) {
      return [];
    }

    return (teamStats.statistics ?? []).flatMap((stat, index) => {
      const statName = stat.label?.trim() || stat.displayName?.trim() || stat.name?.trim();

      if (!statName) {
        return [];
      }

      return [{
        providerTeamId,
        teamName,
        statName,
        statValue: stat.displayValue == null ? null : String(stat.displayValue),
        sortOrder: index
      }];
    });
  });
}

function normalizeEpsnStatus(status: EpsnStatusType | null | undefined): MatchStatus {
  const text = `${status?.name ?? ""} ${status?.description ?? ""} ${status?.detail ?? ""} ${status?.shortDetail ?? ""}`.toLowerCase();

  if (text.includes("postponed") || text.includes("canceled") || text.includes("cancelled") || text.includes("suspended")) {
    return "postponed";
  }

  if (status?.completed || status?.state === "post" || text.includes("full time")) {
    return "final";
  }

  if (text.includes("half") && !text.includes("first") && !text.includes("second")) {
    return "halftime";
  }

  if (status?.state === "in" || text.includes("first half") || text.includes("second half")) {
    return "live";
  }

  return "scheduled";
}

async function fetchScoreboardEvents(fetchImpl: FetchImpl, baseUrl: string, queries: ProviderMatchQuery[]): Promise<EpsnScoreboardEvent[]> {
  const dateKeys = [...new Set(queries.map((query) => espnDateKey(query.kickoffAt)).filter(Boolean))];
  const payloads = await Promise.all(dateKeys.map(async (dateKey) => {
    const response = await fetchImpl(`${baseUrl}/scoreboard?dates=${dateKey}&limit=100`);

    if (!response.ok) {
      throw new Error(`ESPN request failed with ${response.status}`);
    }

    return await response.json() as EpsnScoreboardResponse;
  }));

  return payloads.flatMap((payload) => payload.events ?? []);
}

function findEventForMatch(events: EpsnScoreboardEvent[], query: ProviderMatchQuery): EpsnScoreboardEvent | null {
  if (query.apiProvider === "espn" && query.apiMatchId) {
    const byId = events.find((event) => valueToString(event.id) === query.apiMatchId);

    if (byId) {
      return byId;
    }
  }

  return events.find((event) => eventMatchesQuery(event, query)) ?? null;
}

function eventMatchesQuery(event: EpsnScoreboardEvent, query: ProviderMatchQuery): boolean {
  const { home, away } = competitorsBySide(event.competitions?.[0]?.competitors ?? []);

  return teamMatches(home, query.homeTeam) && teamMatches(away, query.awayTeam);
}

function teamMatches(competitor: EpsnCompetitor | null, team: ProviderMatchQuery["homeTeam"]): boolean {
  const providerTeam = competitor?.team;

  if (!providerTeam) {
    return false;
  }

  return normalizeName(providerTeam.abbreviation) === normalizeName(team.shortCode)
    || normalizeName(providerTeam.displayName) === normalizeName(team.name)
    || normalizeName(providerTeam.name) === normalizeName(team.name);
}

function competitorsBySide(competitors: EpsnCompetitor[]): { home: EpsnCompetitor | null; away: EpsnCompetitor | null } {
  return {
    home: competitors.find((competitor) => competitor.homeAway === "home") ?? null,
    away: competitors.find((competitor) => competitor.homeAway === "away") ?? null
  };
}

function toProviderMatchQuery(match: string | ProviderMatchQuery): ProviderMatchQuery[] {
  if (typeof match !== "string") {
    return [match];
  }

  return [];
}

function winnerFromScore(homeScore: number | null, awayScore: number | null): MatchResult | null {
  if (homeScore == null || awayScore == null) {
    return null;
  }

  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

function espnDateKey(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function normalizeDate(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function valueToString(value: string | number | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return String(value);
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
