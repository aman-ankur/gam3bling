import type { AppMatch } from "@/features/matches/data";
import { getCurrentDate } from "../time/now";

const OPEN_PREDICTION_MATCH_COUNT = 4;
const ACTIVE_MATCH_WINDOW_MS = 150 * 60 * 1_000;
const RECENT_LIVE_SYNC_MS = 30 * 60 * 1_000;

export function getOpenPredictionMatchIds(matches: AppMatch[], now = getCurrentDate()): Set<string> {
  const nowMs = now.getTime();
  const openMatches = matches
    .filter((match) => match.status === "scheduled" && new Date(match.kickoffAt).getTime() > nowMs)
    .slice(0, OPEN_PREDICTION_MATCH_COUNT);

  return new Set(openMatches.flatMap((match) => [match.id, match.apiMatchId]));
}

export function isMatchInOpenPredictionWindow(match: AppMatch, matches: AppMatch[], now = new Date()): boolean {
  const openMatchIds = getOpenPredictionMatchIds(matches, now);

  return openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId);
}

export function getActiveMatchIds(matches: AppMatch[], now = getCurrentDate()): Set<string> {
  const nowMs = now.getTime();
  const activeMatches = matches.filter((match) => isMatchActive(match, nowMs));

  return new Set(activeMatches.flatMap((match) => [match.id, match.apiMatchId]));
}

function isMatchActive(match: AppMatch, nowMs: number): boolean {
  if (match.status === "final" || match.status === "postponed") {
    return false;
  }

  const kickoffMs = new Date(match.kickoffAt).getTime();
  const withinNormalMatchWindow = kickoffMs <= nowMs && nowMs - kickoffMs <= ACTIVE_MATCH_WINDOW_MS;

  if (match.status === "live" || match.status === "halftime") {
    return withinNormalMatchWindow || hasRecentLiveSync(match.lastSyncedAt, nowMs);
  }

  return withinNormalMatchWindow;
}

function hasRecentLiveSync(lastSyncedAt: string | null | undefined, nowMs: number): boolean {
  if (!lastSyncedAt) {
    return false;
  }

  const syncedMs = new Date(lastSyncedAt).getTime();

  return !Number.isNaN(syncedMs) && nowMs - syncedMs <= RECENT_LIVE_SYNC_MS;
}
