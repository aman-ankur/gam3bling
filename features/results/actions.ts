"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withSupabaseRetry } from "@/lib/supabase/retry";
import { syncMatches, syncMatchResult } from "@/features/sync/sync-matches";
import { getResultCheckState } from "./check-window";

type ResultMatchRow = {
  id: string;
  api_match_id: string | null;
  kickoff_at: string;
  last_synced_at: string | null;
  status: string;
};

export async function checkMatchResult(roomSlug: string, matchRouteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=error`);
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
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=error`);
  }

  if (!match) {
    redirect(`/r/${roomSlug}/matches?error=match`);
  }

  const checkState = getResultCheckState(
    {
      kickoffAt: match.kickoff_at,
      lastSyncedAt: match.last_synced_at,
      status: match.status
    },
    new Date()
  );

  if (!checkState.canCheck) {
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=${checkState.reason}`);
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
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=error`);
  }

  if (syncResult.status === "final") {
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=checked`);
  }

  redirect(`/r/${roomSlug}/matches/${matchRouteId}?result=pending`);
}

export async function refreshMatchScore(roomSlug: string, matchRouteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?score=error`);
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
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?score=error`);
  }

  if (!match) {
    redirect(`/r/${roomSlug}/matches?error=match`);
  }

  let scoreStatus: "updated" | "pending";

  try {
    const result = await syncMatchResult({ supabase, matchId: match.id });
    scoreStatus = result.updatedMatch ? "updated" : "pending";
  } catch (error) {
    console.error("[scores.refresh.match] sync_failed", {
      matchRouteId,
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown score refresh error"
    });
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?score=error`);
  }

  redirect(`/r/${roomSlug}/matches/${matchRouteId}?score=${scoreStatus}`);
}

export async function refreshRoomScores(roomSlug: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    redirect(`/r/${roomSlug}?hub=1&scores=error`);
  }

  let scoreStatus: "updated" | "pending";

  try {
    const result = await syncMatches({ supabase });
    scoreStatus = result.updatedMatches > 0 ? "updated" : "pending";
  } catch (error) {
    console.error("[scores.refresh.room] sync_failed", {
      roomSlug,
      message: error instanceof Error ? error.message : "Unknown room score refresh error"
    });
    redirect(`/r/${roomSlug}?hub=1&scores=error`);
  }

  redirect(`/r/${roomSlug}?hub=1&scores=${scoreStatus}`);
}

async function findMatch(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, routeId: string): Promise<ResultMatchRow | null> {
  const byApiMatch = await withSupabaseRetry<ResultMatchRow>(() =>
    supabase
      .from("matches")
      .select("id, api_match_id, kickoff_at, last_synced_at, status")
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
        .select("id, api_match_id, kickoff_at, last_synced_at, status")
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
