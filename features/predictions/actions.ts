"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUpcomingMatches } from "@/features/matches/data";
import { isMatchInOpenPredictionWindow } from "@/features/matches/prediction-window";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { isPredictionLocked } from "@/features/predictions/locking";

export async function savePrediction(roomSlug: string, matchRouteId: string, formData: FormData): Promise<void> {
  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

  console.info("[predictions.save] start", { roomSlug, matchRouteId, hasSession: Boolean(session) });

  if (!session) {
    console.warn("[predictions.save] missing_session", { roomSlug, matchRouteId });
    redirect(`/r/${roomSlug}`);
  }

  if (!supabase) {
    console.warn("[predictions.save] local_fallback", { roomSlug, matchRouteId });
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?saved=local`);
  }

  const match = await findMatch(supabase, matchRouteId);

  if (!match) {
    console.warn("[predictions.save] missing_match", { roomSlug, matchRouteId });
    redirect(`/r/${roomSlug}/matches?error=match`);
  }

  const matches = await getUpcomingMatches();
  const appMatch = matches.find((candidate) => candidate.id === matchRouteId || candidate.apiMatchId === matchRouteId);

  if (isPredictionLocked({ now: new Date(), kickoffAt: new Date(match.kickoff_at) })) {
    console.warn("[predictions.save] kickoff_locked", { roomSlug, matchRouteId });
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?error=locked`);
  }

  if (appMatch && !isMatchInOpenPredictionWindow(appMatch, matches)) {
    console.warn("[predictions.save] window_locked", { roomSlug, matchRouteId });
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?error=locked`);
  }

  const finalHomeScore = numberField(formData, "finalHomeScore");
  const finalAwayScore = numberField(formData, "finalAwayScore");
  const halftimeHomeScore = numberField(formData, "halftimeHomeScore");
  const halftimeAwayScore = numberField(formData, "halftimeAwayScore");
  const matchResult = stringField(formData, "matchResult", "draw");
  const firstScoringTeamId = stringField(formData, "firstScoringTeamId", "");
  const lastScoringTeamId = stringField(formData, "lastScoringTeamId", "");
  const validationError = validatePredictionFields({
    finalAwayScore,
    finalHomeScore,
    firstScoringTeamId,
    halftimeAwayScore,
    halftimeHomeScore,
    lastScoringTeamId,
    matchResult,
    matchAwayTeamId: match.away_team_id,
    matchHomeTeamId: match.home_team_id
  });

  if (validationError) {
    console.warn("[predictions.save] invalid_fields", { roomSlug, matchRouteId, reason: validationError });
    redirect(`/r/${roomSlug}/matches/${matchRouteId}?error=invalid`);
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      match_id: match.id,
      player_id: session.playerId,
      final_home_score: finalHomeScore,
      final_away_score: finalAwayScore,
      halftime_home_score: halftimeHomeScore,
      halftime_away_score: halftimeAwayScore,
      match_result: matchResult,
      first_scoring_team_id: firstScoringTeamId || null,
      last_scoring_team_id: lastScoringTeamId || null,
      locked_at: null
    },
    { onConflict: "match_id,player_id" }
  );

  if (error) {
    console.error("[predictions.save] failed", { roomSlug, matchRouteId, playerId: session.playerId, message: error.message });
    throw new Error(error.message);
  }

  console.info("[predictions.save] success", { roomSlug, matchRouteId, playerId: session.playerId });
  redirect(`/r/${roomSlug}/matches/${matchRouteId}?saved=1`);
}

async function findMatch(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, routeId: string) {
  const byApiMatch = await supabase.from("matches").select("*").eq("api_match_id", routeId).maybeSingle();

  if (byApiMatch.data) {
    return byApiMatch.data;
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeId)) {
    const byId = await supabase.from("matches").select("*").eq("id", routeId).maybeSingle();
    return byId.data;
  }

  return null;
}

function numberField(formData: FormData, key: string): number {
  const value = Number(formData.get(key));

  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error(`Invalid ${key}`);
  }

  return value;
}

function stringField(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validatePredictionFields({
  finalAwayScore,
  finalHomeScore,
  firstScoringTeamId,
  halftimeAwayScore,
  halftimeHomeScore,
  lastScoringTeamId,
  matchAwayTeamId,
  matchHomeTeamId,
  matchResult
}: {
  finalAwayScore: number;
  finalHomeScore: number;
  firstScoringTeamId: string;
  halftimeAwayScore: number;
  halftimeHomeScore: number;
  lastScoringTeamId: string;
  matchAwayTeamId: string;
  matchHomeTeamId: string;
  matchResult: string;
}): string | null {
  const derivedResult = finalHomeScore > finalAwayScore ? "home" : finalAwayScore > finalHomeScore ? "away" : "draw";

  if (matchResult !== derivedResult) {
    return "result_mismatch";
  }

  if (halftimeHomeScore > finalHomeScore || halftimeAwayScore > finalAwayScore) {
    return "halftime_exceeds_final";
  }

  const scoringTeamIds = new Set<string>();

  if (finalHomeScore > 0) {
    scoringTeamIds.add(matchHomeTeamId);
  }

  if (finalAwayScore > 0) {
    scoringTeamIds.add(matchAwayTeamId);
  }

  if (scoringTeamIds.size === 0) {
    return firstScoringTeamId || lastScoringTeamId ? "scorer_without_goals" : null;
  }

  if (!firstScoringTeamId || !lastScoringTeamId) {
    return "missing_scorer";
  }

  if (!scoringTeamIds.has(firstScoringTeamId) || !scoringTeamIds.has(lastScoringTeamId)) {
    return "scorer_team_did_not_score";
  }

  return null;
}
