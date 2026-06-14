import { scorePrediction } from "../scoring/score-prediction";
import type { MatchResult, MatchStatus } from "../matches/types";
import { createApiFootballProvider } from "./api-football-provider";
import type { FootballProvider, ProviderMatchUpdate } from "./provider";

type LocalMatchRow = {
  id: string;
  api_match_id: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
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
  };
  update(payload: Record<string, unknown>): {
    eq(column: string, value: string): Promise<MutationResult>;
  };
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

export type SyncMatchesOptions = {
  supabase: SyncSupabaseClient;
  provider?: FootballProvider;
  now?: () => Date;
};

export async function syncMatches({
  supabase,
  provider = createApiFootballProvider(),
  now = () => new Date()
}: SyncMatchesOptions): Promise<SyncMatchesResult> {
  await logSync(supabase, provider.name, "started", "Starting football sync");

  try {
    const { data: matches, error: matchError } = await matchTable(supabase)
      .select("id, api_match_id, status, home_score, away_score")
      .not("api_match_id", "is", null);

    if (matchError) {
      throw new Error(matchError.message);
    }

    const localMatches = ((matches ?? []) as LocalMatchRow[]).filter((match) => match.api_match_id);
    const updates = await provider.fetchUpdates(localMatches.map((match) => match.api_match_id as string));
    const matchesByApiId = new Map(localMatches.map((match) => [match.api_match_id as string, match]));
    const syncedAt = now().toISOString();

    let updatedMatches = 0;
    let scoredPredictions = 0;
    let skippedMatches = 0;

    for (const update of updates) {
      const localMatch = matchesByApiId.get(update.apiMatchId);

      if (!localMatch) {
        skippedMatches += 1;
        continue;
      }

      await updateMatch(supabase, localMatch.id, update, syncedAt);
      updatedMatches += 1;

      if (update.status === "final" && update.homeScore != null && update.awayScore != null) {
        scoredPredictions += await scoreFinalMatchPredictions(supabase, localMatch.id, update, syncedAt);
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
    first_scoring_team_id: null,
    last_scoring_team_id: null,
    last_synced_at: syncedAt,
    updated_at: syncedAt
  };

  if (update.kickoffAt) {
    payload.kickoff_at = update.kickoffAt;
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
        firstScoringTeamId: null,
        lastScoringTeamId: null
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

function predictionTable(supabase: SyncSupabaseClient): PredictionTable {
  return supabase.from("predictions") as PredictionTable;
}

function syncLogTable(supabase: SyncSupabaseClient): SyncLogTable {
  return supabase.from("sync_logs") as SyncLogTable;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown football sync error";
}
