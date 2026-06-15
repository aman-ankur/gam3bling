import { scorePrediction } from "../scoring/score-prediction";
import type { MatchResult, MatchStatus } from "../matches/types";
import { createDefaultFootballProvider } from "./default-provider";
import type { FootballProvider, ProviderMatchQuery, ProviderMatchUpdate } from "./provider";

type LocalMatchRow = {
  id: string;
  api_provider: string | null;
  api_match_id: string | null;
  kickoff_at: string;
  home_team_id: string;
  away_team_id: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
};

type LocalTeamRow = {
  id: string;
  name: string;
  short_code: string;
};

type PredictionRow = {
  id: string;
  final_home_score: number;
  final_away_score: number;
  match_result: MatchResult;
  halftime_home_score: number;
  halftime_away_score: number;
  first_scoring_team_id: string | null;
  last_scoring_team_id: string | null;
};

type DbError = {
  message: string;
};

type DbResult<T> = {
  data: T | null;
  error: DbError | null;
};

type MutationResult = {
  error: DbError | null;
};

type MatchTable = {
  select(columns: string): {
    not(column: string, operator: string, value: null): Promise<DbResult<LocalMatchRow[]>>;
    eq(column: string, value: string): {
      single(): Promise<DbResult<LocalMatchRow>>;
    };
  };
  update(payload: Record<string, unknown>): {
    eq(column: string, value: string): Promise<MutationResult>;
  };
};

type TeamTable = {
  select(columns: string): Promise<DbResult<LocalTeamRow[]>>;
};

type PredictionTable = {
  select(columns: string): {
    eq(column: string, value: string): Promise<DbResult<PredictionRow[]>>;
  };
  update(payload: Record<string, unknown>): {
    eq(column: string, value: string): Promise<MutationResult>;
  };
};

type SyncLogTable = {
  insert(payload: Record<string, unknown>): Promise<MutationResult>;
};

type SyncSupabaseClient = {
  from(table: string): unknown;
};

export type SyncMatchesResult = {
  fetchedMatches: number;
  updatedMatches: number;
  scoredPredictions: number;
  skippedMatches: number;
};

export type SyncMatchResultResult = {
  found: boolean;
  fetchedMatches: number;
  updatedMatch: boolean;
  scoredPredictions: number;
  status: MatchStatus | null;
};

export type SyncMatchesOptions = {
  supabase: SyncSupabaseClient;
  provider?: FootballProvider;
  now?: () => Date;
};

export async function syncMatches({
  supabase,
  provider = createDefaultFootballProvider(),
  now = () => new Date()
}: SyncMatchesOptions): Promise<SyncMatchesResult> {
  await logSync(supabase, provider.name, "started", "Starting football sync");

  try {
    const [{ data: matches, error: matchError }, { data: teams, error: teamError }] = await Promise.all([
      matchTable(supabase)
        .select("id, api_provider, api_match_id, kickoff_at, home_team_id, away_team_id, status, home_score, away_score")
        .not("api_match_id", "is", null),
      teamTable(supabase).select("id, name, short_code")
    ]);

    if (matchError || teamError) {
      throw new Error(matchError?.message ?? teamError?.message);
    }

    const teamsById = new Map(((teams ?? []) as LocalTeamRow[]).map((team) => [team.id, team]));
    const localMatches = ((matches ?? []) as LocalMatchRow[]).filter((match) => match.api_match_id && match.api_provider !== "demo");
    const providerMatches = localMatches.flatMap((match) => providerMatchQuery(match, teamsById));
    const updates = await provider.fetchUpdates(providerMatches);
    const matchesByApiId = new Map(localMatches.map((match) => [match.api_match_id as string, match]));
    const matchesByLocalId = new Map(localMatches.map((match) => [match.id, match]));
    const syncedAt = now().toISOString();

    let updatedMatches = 0;
    let scoredPredictions = 0;
    let skippedMatches = 0;

    for (const update of updates) {
      const localMatch = update.localMatchId
        ? matchesByLocalId.get(update.localMatchId)
        : matchesByApiId.get(update.apiMatchId);

      if (!localMatch) {
        skippedMatches += 1;
        continue;
      }

      const resolvedUpdate = resolveMatchUpdateTeams(localMatch, update);
      await updateMatch(supabase, localMatch.id, resolvedUpdate, syncedAt);
      updatedMatches += 1;

      if (resolvedUpdate.status === "final" && resolvedUpdate.homeScore != null && resolvedUpdate.awayScore != null) {
        scoredPredictions += await scoreFinalMatchPredictions(supabase, localMatch.id, resolvedUpdate, syncedAt);
      }
    }

    const result = {
      fetchedMatches: updates.length,
      updatedMatches,
      scoredPredictions,
      skippedMatches
    };

    await logSync(
      supabase,
      provider.name,
      "success",
      `Fetched ${result.fetchedMatches}, updated ${result.updatedMatches}, scored ${result.scoredPredictions}`
    );

    return result;
  } catch (error) {
    await logSync(supabase, provider.name, "failed", errorMessage(error));
    throw error;
  }
}

export async function syncMatchResult({
  supabase,
  matchId,
  provider = createDefaultFootballProvider(),
  now = () => new Date()
}: SyncMatchesOptions & { matchId: string }): Promise<SyncMatchResultResult> {
  const { data: localMatch, error: matchError } = await matchTable(supabase)
    .select("id, api_provider, api_match_id, kickoff_at, home_team_id, away_team_id, status, home_score, away_score")
    .eq("id", matchId)
    .single();

  if (matchError) {
    throw new Error(matchError.message);
  }

  if (!localMatch?.api_match_id) {
    return {
      found: false,
      fetchedMatches: 0,
      updatedMatch: false,
      scoredPredictions: 0,
      status: null
    };
  }

  const syncedAt = now().toISOString();
  const { data: teams, error: teamError } = await teamTable(supabase).select("id, name, short_code");

  if (teamError) {
    throw new Error(teamError.message);
  }

  const matchQuery = providerMatchQuery(localMatch, new Map(((teams ?? []) as LocalTeamRow[]).map((team) => [team.id, team])))[0];
  const updates = localMatch.api_provider === "demo"
    ? [createDemoMatchUpdate(localMatch)]
    : matchQuery ? await provider.fetchUpdates([matchQuery]) : [];
  const update = updates.find((candidate) =>
    candidate.localMatchId === localMatch.id || candidate.apiMatchId === localMatch.api_match_id
  );

  if (!update) {
    return {
      found: true,
      fetchedMatches: updates.length,
      updatedMatch: false,
      scoredPredictions: 0,
      status: localMatch.status
    };
  }

  const resolvedUpdate = resolveMatchUpdateTeams(localMatch, update);
  await updateMatch(supabase, localMatch.id, resolvedUpdate, syncedAt);

  const scoredPredictions =
    resolvedUpdate.status === "final" && resolvedUpdate.homeScore != null && resolvedUpdate.awayScore != null
      ? await scoreFinalMatchPredictions(supabase, localMatch.id, resolvedUpdate, syncedAt)
      : 0;

  return {
    found: true,
    fetchedMatches: updates.length,
    updatedMatch: true,
    scoredPredictions,
    status: resolvedUpdate.status
  };
}

function resolveMatchUpdateTeams(localMatch: LocalMatchRow, update: ProviderMatchUpdate): ProviderMatchUpdate {
  return {
    ...update,
    firstScoringTeamId: update.firstScoringTeamId ?? resolveExternalTeamId(localMatch, update, update.firstScoringTeamExternalId),
    lastScoringTeamId: update.lastScoringTeamId ?? resolveExternalTeamId(localMatch, update, update.lastScoringTeamExternalId)
  };
}

function providerMatchQuery(localMatch: LocalMatchRow, teamsById: Map<string, LocalTeamRow>): ProviderMatchQuery[] {
  const homeTeam = teamsById.get(localMatch.home_team_id);
  const awayTeam = teamsById.get(localMatch.away_team_id);

  if (!homeTeam || !awayTeam) {
    return [];
  }

  return [{
    localMatchId: localMatch.id,
    apiProvider: localMatch.api_provider,
    apiMatchId: localMatch.api_match_id,
    kickoffAt: localMatch.kickoff_at,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      shortCode: homeTeam.short_code
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      shortCode: awayTeam.short_code
    }
  }];
}

function resolveExternalTeamId(
  localMatch: LocalMatchRow,
  update: ProviderMatchUpdate,
  externalTeamId: string | null | undefined
): string | null {
  if (!externalTeamId) {
    return null;
  }

  if (externalTeamId === update.homeTeamExternalId) {
    return localMatch.home_team_id;
  }

  if (externalTeamId === update.awayTeamExternalId) {
    return localMatch.away_team_id;
  }

  return null;
}

async function updateMatch(
  supabase: SyncSupabaseClient,
  matchId: string,
  update: ProviderMatchUpdate,
  syncedAt: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    status: update.status,
    home_score: update.homeScore ?? null,
    away_score: update.awayScore ?? null,
    home_halftime_score: update.homeHalftimeScore ?? null,
    away_halftime_score: update.awayHalftimeScore ?? null,
    winner: update.winner ?? null,
    first_scoring_team_id: update.firstScoringTeamId ?? null,
    last_scoring_team_id: update.lastScoringTeamId ?? null,
    last_synced_at: syncedAt,
    updated_at: syncedAt
  };

  if (update.kickoffAt) {
    payload.kickoff_at = update.kickoffAt;
  }

  const clockAnchoredKickoffAt = kickoffFromProviderClock(update, syncedAt);

  if (clockAnchoredKickoffAt) {
    payload.kickoff_at = clockAnchoredKickoffAt;
  }

  const { error } = await matchTable(supabase).update(payload).eq("id", matchId);

  if (error) {
    throw new Error(error.message);
  }
}

async function scoreFinalMatchPredictions(
  supabase: SyncSupabaseClient,
  matchId: string,
  update: ProviderMatchUpdate,
  scoredAt: string
): Promise<number> {
  const { data: predictions, error: predictionError } = await predictionTable(supabase)
    .select("*")
    .eq("match_id", matchId);

  if (predictionError) {
    throw new Error(predictionError.message);
  }

  let scoredPredictions = 0;

  for (const prediction of (predictions ?? []) as PredictionRow[]) {
    const score = scorePrediction(
      {
        finalHomeScore: prediction.final_home_score,
        finalAwayScore: prediction.final_away_score,
        matchResult: prediction.match_result,
        halftimeHomeScore: prediction.halftime_home_score,
        halftimeAwayScore: prediction.halftime_away_score,
        firstScoringTeamId: prediction.first_scoring_team_id,
        lastScoringTeamId: prediction.last_scoring_team_id
      },
      {
        homeScore: update.homeScore,
        awayScore: update.awayScore,
        halftimeHomeScore: update.homeHalftimeScore,
        halftimeAwayScore: update.awayHalftimeScore,
        winner: update.winner,
        firstScoringTeamId: update.firstScoringTeamId ?? null,
        lastScoringTeamId: update.lastScoringTeamId ?? null
      }
    );

    const { error: updateError } = await predictionTable(supabase)
      .update({
        score_final: score.scoreFinal,
        score_result: score.scoreResult,
        score_halftime: score.scoreHalftime,
        score_first_scorer: score.scoreFirstScorer,
        score_last_scorer: score.scoreLastScorer,
        score_total: score.scoreTotal,
        scored_at: scoredAt
      })
      .eq("id", prediction.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    scoredPredictions += 1;
  }

  return scoredPredictions;
}

function createDemoMatchUpdate(match: LocalMatchRow): ProviderMatchUpdate {
  return {
    apiMatchId: match.api_match_id as string,
    status: "final",
    homeScore: 2,
    awayScore: 1,
    homeHalftimeScore: 1,
    awayHalftimeScore: 0,
    winner: "home",
    firstScoringTeamId: match.home_team_id,
    lastScoringTeamId: match.away_team_id
  };
}

function kickoffFromProviderClock(update: ProviderMatchUpdate, syncedAt: string): string | null {
  if (update.status !== "live" || !update.matchClock) {
    return null;
  }

  const elapsedSeconds = elapsedSecondsFromClock(update.matchClock);

  if (elapsedSeconds == null) {
    return null;
  }

  const syncedMs = new Date(syncedAt).getTime();

  if (Number.isNaN(syncedMs)) {
    return null;
  }

  return new Date(syncedMs - elapsedSeconds * 1000).toISOString();
}

function elapsedSecondsFromClock(clock: string): number | null {
  const normalized = clock.trim();
  const clockMatch = normalized.match(/^(\d{1,3})(?::(\d{1,2}))?$/);

  if (clockMatch) {
    const minutes = Number(clockMatch[1]);
    const seconds = Number(clockMatch[2] ?? 0);

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + Math.min(seconds, 59);
    }
  }

  const stoppageMatch = normalized.match(/^(\d{1,3})\s*\+\s*(\d{1,2})/);

  if (stoppageMatch) {
    return (Number(stoppageMatch[1]) + Number(stoppageMatch[2])) * 60;
  }

  return null;
}

async function logSync(
  supabase: SyncSupabaseClient,
  provider: string,
  status: "started" | "success" | "failed",
  message: string
): Promise<void> {
  await syncLogTable(supabase).insert({
    provider,
    sync_type: "football",
    status,
    message
  });
}

function matchTable(supabase: SyncSupabaseClient): MatchTable {
  return supabase.from("matches") as MatchTable;
}

function teamTable(supabase: SyncSupabaseClient): TeamTable {
  return supabase.from("teams") as TeamTable;
}

function predictionTable(supabase: SyncSupabaseClient): PredictionTable {
  return supabase.from("predictions") as PredictionTable;
}

function syncLogTable(supabase: SyncSupabaseClient): SyncLogTable {
  return supabase.from("sync_logs") as SyncLogTable;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown football sync error";
}
