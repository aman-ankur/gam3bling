"use server";

import { redirect } from "next/navigation";
import { ensureMatchDetailsForMatches } from "@/features/match-details/cache";
import { createSupabaseMatchDetailsStore } from "@/features/match-details/data";
import { getMatchByRouteId } from "@/features/matches/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withSupabaseRetry } from "@/lib/supabase/retry";
import { createDefaultFootballProvider } from "@/features/sync/default-provider";
import { syncMatches, syncMatchResult } from "@/features/sync/sync-matches";
import { getResultCheckState } from "./check-window";

type ResultMatchRow = {
  id: string;
  api_match_id: string | null;
  kickoff_at: string;
  last_synced_at: string | null;
  stage: string | null;
  status: string;
};

type InlineActionResult = {
  ok: boolean;
  message: string;
  status: string;
};

type ResultCheckStatus = "checked" | "pending" | "cooldown" | "early" | "final" | "error" | "match";
type ScoreRefreshStatus = "refreshed" | "pending" | "error" | "match";

export async function checkMatchResult(roomSlug: string, matchRouteId: string): Promise<void> {
  const resultStatus = await checkMatchResultStatus(roomSlug, matchRouteId);

  if (resultStatus === "match") {
    redirect(`/r/${roomSlug}/matches?error=match`);
  }

  redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=${resultStatus}`);
}

export async function checkMatchResultInline(roomSlug: string, matchRouteId: string): Promise<InlineActionResult> {
  const status = await checkMatchResultStatus(roomSlug, matchRouteId);

  return {
    ok: status === "checked",
    status,
    message: resultMessage(status)
  };
}

export async function refreshMatchScore(roomSlug: string, matchRouteId: string): Promise<void> {
  const scoreStatus = await refreshMatchScoreStatus(roomSlug, matchRouteId);

  if (scoreStatus === "match") {
    redirect(`/r/${roomSlug}/matches?error=match`);
  }

  redirect(`/r/${roomSlug}/matches/${matchRouteId}?score=${scoreStatus}`);
}

export async function refreshMatchScoreInline(roomSlug: string, matchRouteId: string): Promise<InlineActionResult> {
  const status = await refreshMatchScoreStatus(roomSlug, matchRouteId);

  return {
    ok: status === "refreshed",
    status,
    message: matchScoreMessage(status)
  };
}

export async function refreshRoomScores(roomSlug: string): Promise<void> {
  const scoreStatus = await refreshRoomScoresStatus(roomSlug);

  redirect(`/r/${roomSlug}?hub=1&scores=${scoreStatus}`);
}

export async function refreshRoomScoresInline(roomSlug: string): Promise<InlineActionResult> {
  const status = await refreshRoomScoresStatus(roomSlug);

  return {
    ok: status === "refreshed",
    status,
    message: roomScoreMessage(status)
  };
}

async function checkMatchResultStatus(roomSlug: string, matchRouteId: string): Promise<ResultCheckStatus> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return "error";
  }

  let match;

  try {
    match = await findMatch(supabase, matchRouteId);
  } catch (error) {
    console.error("[results.check] match_lookup_failed", {
      matchRouteId,
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown match lookup error"
    });
    return "error";
  }

  if (!match) {
    return "match";
  }

  const checkState = getResultCheckState(
    {
      kickoffAt: match.kickoff_at,
      lastSyncedAt: match.last_synced_at,
      stage: match.stage,
      status: match.status
    },
    new Date()
  );

  if (!checkState.canCheck) {
    return checkState.reason === "available" ? "pending" : checkState.reason;
  }

  let syncResult;

  try {
    syncResult = await syncMatchResult({ supabase, matchId: match.id });
  } catch (error) {
    console.error("[results.check] sync_failed", {
      matchRouteId,
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown result check error"
    });
    return "error";
  }

  if (syncResult.status === "final") {
    return "checked";
  }

  return "pending";
}

async function refreshMatchScoreStatus(roomSlug: string, matchRouteId: string): Promise<ScoreRefreshStatus> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return "error";
  }

  let match;

  try {
    match = await findMatch(supabase, matchRouteId);
  } catch (error) {
    console.error("[scores.refresh.match] match_lookup_failed", {
      matchRouteId,
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown match lookup error"
    });
    return "error";
  }

  if (!match) {
    return "match";
  }

  let scoreStatus: "refreshed" | "pending";

  try {
    const result = await syncMatchResult({ supabase, matchId: match.id });
    scoreStatus = result.updatedMatch ? "refreshed" : "pending";
    await refreshDetailsForMatchIfAvailable({ matchRouteId, supabase });
  } catch (error) {
    console.error("[scores.refresh.match] sync_failed", {
      matchRouteId,
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown score refresh error"
    });
    return "error";
  }

  return scoreStatus;
}

async function refreshRoomScoresStatus(roomSlug: string): Promise<ScoreRefreshStatus> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return "error";
  }

  let scoreStatus: "refreshed" | "pending";

  try {
    const result = await syncMatches({ supabase });
    scoreStatus = result.updatedMatches > 0 ? "refreshed" : "pending";
  } catch (error) {
    console.error("[scores.refresh.room] sync_failed", {
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown room score refresh error"
    });
    return "error";
  }

  return scoreStatus;
}

function resultMessage(status: ResultCheckStatus): string {
  if (status === "checked") {
    return "Final result checked and room scores refreshed.";
  }

  if (status === "pending") {
    return "Official final result is not available yet.";
  }

  if (status === "cooldown") {
    return "This match was checked recently. Try again in a few minutes.";
  }

  if (status === "early") {
    return "Result checks open around 115 minutes after kickoff.";
  }

  if (status === "match") {
    return "This fixture could not be found.";
  }

  return "The provider check failed. Try again in a few minutes.";
}

function matchScoreMessage(status: ScoreRefreshStatus): string {
  if (status === "refreshed") {
    return "Latest score loaded.";
  }

  if (status === "pending") {
    return "Score checked. No provider update yet.";
  }

  if (status === "match") {
    return "This fixture could not be found.";
  }

  return "The score refresh failed. Try again in a few minutes.";
}

function roomScoreMessage(status: ScoreRefreshStatus): string {
  if (status === "refreshed") {
    return "Room scores refreshed.";
  }

  if (status === "pending") {
    return "Scores checked. No provider update yet.";
  }

  return "Could not refresh scores right now.";
}

async function refreshDetailsForMatchIfAvailable({
  matchRouteId,
  supabase
}: {
  matchRouteId: string;
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
}): Promise<void> {
  try {
    const match = await getMatchByRouteId(matchRouteId);

    if (!match) {
      return;
    }

    const result = await ensureMatchDetailsForMatches({
      force: true,
      matches: [match],
      provider: createDefaultFootballProvider(),
      store: createSupabaseMatchDetailsStore(supabase)
    });

    if (result.failed > 0) {
      console.warn("[scores.refresh.match_details] details_refresh_failed", {
        matchRouteId,
        messages: result.failureMessages
      });
    }
  } catch (error) {
    console.warn("[scores.refresh.match_details] details_refresh_failed", {
      matchRouteId,
      message: error instanceof Error ? error.message : "Unknown details refresh error"
    });
  }
}

async function findMatch(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, routeId: string): Promise<ResultMatchRow | null> {
  const byApiMatch = await withSupabaseRetry<ResultMatchRow>(() =>
    supabase
      .from("matches")
      .select("id, api_match_id, kickoff_at, last_synced_at, stage, status")
      .eq("api_match_id", routeId)
      .maybeSingle()
  , { label: "results.check.matches.select_by_api_match_id" });

  if (byApiMatch.error) {
    throw new Error(byApiMatch.error.message);
  }

  if (byApiMatch.data) {
    return byApiMatch.data as ResultMatchRow;
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeId)) {
    const byId = await withSupabaseRetry<ResultMatchRow>(() =>
      supabase
        .from("matches")
        .select("id, api_match_id, kickoff_at, last_synced_at, stage, status")
        .eq("id", routeId)
        .maybeSingle()
    , { label: "results.check.matches.select_by_id" });

    if (byId.error) {
      throw new Error(byId.error.message);
    }

    return (byId.data as ResultMatchRow | null) ?? null;
  }

  return null;
}
