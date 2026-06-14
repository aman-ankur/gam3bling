import type { AppMatch } from "@/features/matches/data";

const OPEN_PREDICTION_MATCH_COUNT = 4;

export function getOpenPredictionMatchIds(matches: AppMatch[], now = new Date()): Set<string> {
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
