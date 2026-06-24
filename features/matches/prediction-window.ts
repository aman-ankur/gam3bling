import type { AppMatch } from "@/features/matches/data";
import { getCurrentDate } from "../time/now";

const OPEN_PREDICTION_MATCH_COUNT = 8;
const ACTIVE_MATCH_WINDOW_MS = 150 * 60 * 1_000;
const RECENT_LIVE_SYNC_MS = 30 * 60 * 1_000;
const IST_DAY_MS = 24 * 60 * 60 * 1_000;
const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric"
});

export function getOpenPredictionMatchIds(matches: AppMatch[], now = getCurrentDate()): Set<string> {
  const nowMs = now.getTime();
  const openDateKeys = new Set([istDateKey(now), istDateKey(new Date(nowMs + IST_DAY_MS))]);
  const openMatches = matches
    .filter((match) => {
      const kickoff = new Date(match.kickoffAt);

      return match.status === "scheduled" && kickoff.getTime() > nowMs && openDateKeys.has(istDateKey(kickoff));
    })
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

function istDateKey(date: Date): string {
  const parts = IST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}
