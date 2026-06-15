import type {
  FootballProvider,
  ProviderLineup,
  ProviderLineupPlayer,
  ProviderMatchDetails,
  ProviderMatchUpdate,
  ProviderTeamStatistic
} from "./provider";
import type { MatchResult, MatchStatus } from "../matches/types";

type FetchImpl = typeof fetch;

type ApiFootballProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: FetchImpl;
};

type ApiFootballFixture = {
  fixture?: {
    id?: number | string;
    date?: string;
    status?: {
      short?: string | null;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };
  };
  teams?: {
    home?: {
      id?: number | string | null;
    } | null;
    away?: {
      id?: number | string | null;
    } | null;
  };
  events?: Array<{
    type?: string | null;
    detail?: string | null;
    team?: {
      id?: number | string | null;
    } | null;
  }>;
};

type ApiFootballResponse = {
  response?: ApiFootballFixture[];
  errors?: unknown;
};

type ApiFootballLineupPlayerEntry = {
  player?: {
    id?: number | string | null;
    name?: string | null;
    number?: number | null;
    pos?: string | null;
    grid?: string | null;
  } | null;
};

type ApiFootballLineup = {
  team?: {
    id?: number | string | null;
    name?: string | null;
  } | null;
  coach?: {
    name?: string | null;
  } | null;
  formation?: string | null;
  startXI?: ApiFootballLineupPlayerEntry[];
  substitutes?: ApiFootballLineupPlayerEntry[];
};

type ApiFootballLineupsResponse = {
  response?: ApiFootballLineup[];
  errors?: unknown;
};

type ApiFootballStatistic = {
  type?: string | null;
  value?: string | number | null;
};

type ApiFootballTeamStatistics = {
  team?: {
    id?: number | string | null;
    name?: string | null;
  } | null;
  statistics?: ApiFootballStatistic[];
};

type ApiFootballStatisticsResponse = {
  response?: ApiFootballTeamStatistics[];
  errors?: unknown;
};

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const NON_SCORING_GOAL_EVENT_DETAILS = new Set(["MISSED PENALTY"]);

const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  LIVE: "live",
  HT: "halftime",
  FT: "final",
  AET: "final",
  PEN: "final",
  PST: "postponed",
  SUSP: "postponed",
  INT: "postponed",
  CANC: "postponed",
  ABD: "postponed",
  AWD: "final",
  WO: "final"
};

export function createApiFootballProvider(options: ApiFootballProviderOptions = {}): FootballProvider {
  const apiKey = options.apiKey ?? process.env.API_FOOTBALL_KEY;
  const baseUrl = trimTrailingSlash(options.baseUrl ?? process.env.API_FOOTBALL_BASE_URL ?? DEFAULT_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "api-football",
    async fetchUpdates(apiMatchIds: string[]): Promise<ProviderMatchUpdate[]> {
      if (!apiKey) {
        throw new Error("API_FOOTBALL_KEY is not configured");
      }

      const numericIds = apiMatchIds.filter((apiMatchId) => /^\d+$/.test(apiMatchId));
      const updates = await Promise.all(
        numericIds.map(async (apiMatchId) => {
          const response = await fetchImpl(`${baseUrl}/fixtures?id=${encodeURIComponent(apiMatchId)}`, {
            headers: {
              "x-apisports-key": apiKey
            }
          });

          if (!response.ok) {
            throw new Error(`API-FOOTBALL request failed with ${response.status}`);
          }

          const payload = (await response.json()) as ApiFootballResponse;

          const providerErrorMessage = providerErrorsMessage(payload.errors);

          if (providerErrorMessage) {
            throw new Error(providerErrorMessage);
          }

          return (payload.response ?? []).map(normalizeApiFootballFixture);
        })
      );

      return updates.flat();
    },
    async fetchMatchDetails(apiMatchId: string): Promise<ProviderMatchDetails> {
      if (!apiKey) {
        throw new Error("API_FOOTBALL_KEY is not configured");
      }

      const [lineupsPayload, statisticsPayload] = await Promise.all([
        fetchApiFootball<ApiFootballLineupsResponse>(fetchImpl, `${baseUrl}/fixtures/lineups?fixture=${encodeURIComponent(apiMatchId)}`, apiKey),
        fetchApiFootball<ApiFootballStatisticsResponse>(fetchImpl, `${baseUrl}/fixtures/statistics?fixture=${encodeURIComponent(apiMatchId)}`, apiKey)
      ]);
      const rawLineups = lineupsPayload.response ?? [];
      const rawStatistics = statisticsPayload.response ?? [];
      const lineups = normalizeApiFootballLineups(rawLineups);
      const statistics = normalizeApiFootballStatistics(rawStatistics);

      return {
        apiMatchId,
        lineupsStatus: lineups.length > 0 ? "available" : "unavailable",
        statisticsStatus: statistics.length > 0 ? "available" : "unavailable",
        lineups,
        statistics,
        rawPayload: {
          lineups: rawLineups,
          statistics: rawStatistics
        }
      };
    }
  };
}

export function normalizeApiFootballFixture(fixture: ApiFootballFixture): ProviderMatchUpdate {
  const apiMatchId = fixture.fixture?.id;

  if (apiMatchId == null) {
    throw new Error("API-FOOTBALL fixture response is missing fixture.id");
  }

  const homeScore = numberOrNull(fixture.goals?.home);
  const awayScore = numberOrNull(fixture.goals?.away);
  const homeTeamExternalId = valueToString(fixture.teams?.home?.id);
  const awayTeamExternalId = valueToString(fixture.teams?.away?.id);
  const goalTeamIds = (fixture.events ?? [])
    .filter(isScoringGoalEvent)
    .map((event) => String(event.team?.id));

  return {
    apiMatchId: String(apiMatchId),
    status: normalizeApiFootballStatus(fixture.fixture?.status?.short),
    homeScore,
    awayScore,
    homeTeamExternalId,
    awayTeamExternalId,
    winner: winnerFromScore(homeScore, awayScore),
    homeHalftimeScore: numberOrNull(fixture.score?.halftime?.home),
    awayHalftimeScore: numberOrNull(fixture.score?.halftime?.away),
    firstScoringTeamExternalId: goalTeamIds[0] ?? null,
    lastScoringTeamExternalId: goalTeamIds.at(-1) ?? null,
    kickoffAt: normalizeDate(fixture.fixture?.date)
  };
}

export function normalizeApiFootballStatus(status: string | null | undefined): MatchStatus {
  return STATUS_MAP[(status ?? "").toUpperCase()] ?? "scheduled";
}

function isScoringGoalEvent(event: NonNullable<ApiFootballFixture["events"]>[number]): boolean {
  const type = event.type?.trim().toUpperCase();
  const detail = event.detail?.trim().toUpperCase();

  return type === "GOAL" && event.team?.id != null && !NON_SCORING_GOAL_EVENT_DETAILS.has(detail ?? "");
}

export function normalizeApiFootballLineups(lineups: ApiFootballLineup[]): ProviderLineup[] {
  return lineups.flatMap((lineup) => {
    const providerTeamId = valueToString(lineup.team?.id);
    const teamName = lineup.team?.name?.trim();

    if (!providerTeamId || !teamName) {
      return [];
    }

    const starters = normalizeLineupPlayers(lineup.startXI ?? [], "starter", 0);
    const substitutes = normalizeLineupPlayers(lineup.substitutes ?? [], "substitute", starters.length);

    return [{
      providerTeamId,
      teamName,
      coachName: lineup.coach?.name?.trim() || null,
      formation: lineup.formation?.trim() || null,
      players: [...starters, ...substitutes]
    }];
  });
}

export function normalizeApiFootballStatistics(statistics: ApiFootballTeamStatistics[]): ProviderTeamStatistic[] {
  return statistics.flatMap((teamStats) => {
    const providerTeamId = valueToString(teamStats.team?.id);
    const teamName = teamStats.team?.name?.trim();

    if (!providerTeamId || !teamName) {
      return [];
    }

    return (teamStats.statistics ?? []).flatMap<ProviderTeamStatistic>((stat, index) => {
      const statName = stat.type?.trim();

      if (!statName) {
        return [];
      }

      return [{
        providerTeamId,
        teamName,
        statName,
        statValue: stat.value == null ? null : String(stat.value),
        sortOrder: index
      }];
    });
  });
}

async function fetchApiFootball<T>(fetchImpl: FetchImpl, url: string, apiKey: string): Promise<T & { errors?: unknown }> {
  const response = await fetchImpl(url, {
    headers: {
      "x-apisports-key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`API-FOOTBALL request failed with ${response.status}`);
  }

  const payload = (await response.json()) as T & { errors?: unknown };

  const providerErrorMessage = providerErrorsMessage(payload.errors);

  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return payload;
}

function normalizeLineupPlayers(
  entries: ApiFootballLineupPlayerEntry[],
  role: ProviderLineupPlayer["role"],
  sortOffset: number
): ProviderLineupPlayer[] {
  return entries.flatMap((entry, index) => {
    const playerName = entry.player?.name?.trim();

    if (!playerName) {
      return [];
    }

    return [{
      providerPlayerId: valueToString(entry.player?.id),
      playerName,
      shirtNumber: typeof entry.player?.number === "number" ? entry.player.number : null,
      position: entry.player?.pos?.trim() || null,
      grid: entry.player?.grid?.trim() || null,
      role,
      sortOrder: sortOffset + index
    }];
  });
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

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function valueToString(value: number | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return String(value);
}

function normalizeDate(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function providerErrorsMessage(errors: unknown): string | null {
  if (!errors) {
    return null;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0 ? `API-FOOTBALL returned errors: ${errors.map(String).join("; ")}` : null;
  }

  if (typeof errors === "object") {
    const entries = Object.entries(errors as Record<string, unknown>);

    if (entries.length === 0) {
      return null;
    }

    return `API-FOOTBALL returned errors: ${entries.map(([key, value]) => `${key}: ${String(value)}`).join("; ")}`;
  }

  return `API-FOOTBALL returned errors: ${String(errors)}`;
}
