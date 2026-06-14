import type { FootballProvider, ProviderMatchUpdate } from "./provider";
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
  events?: Array<{
    type?: string | null;
    team?: {
      id?: number | string | null;
    } | null;
  }>;
};

type ApiFootballResponse = {
  response?: ApiFootballFixture[];
  errors?: unknown;
};

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

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

          if (hasProviderErrors(payload.errors)) {
            throw new Error("API-FOOTBALL returned errors");
          }

          return (payload.response ?? []).map(normalizeApiFootballFixture);
        })
      );

      return updates.flat();
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
  const goalTeamIds = (fixture.events ?? [])
    .filter((event) => event.type === "Goal" && event.team?.id != null)
    .map((event) => String(event.team?.id));

  return {
    apiMatchId: String(apiMatchId),
    status: normalizeApiFootballStatus(fixture.fixture?.status?.short),
    homeScore,
    awayScore,
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

function hasProviderErrors(errors: unknown): boolean {
  if (!errors) {
    return false;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0;
  }

  return typeof errors === "object" && Object.keys(errors).length > 0;
}
