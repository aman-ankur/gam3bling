import type { MatchStatus } from "./types";

export function getMatchClockLabel({
  kickoffAt,
  now,
  status
}: {
  kickoffAt: string;
  now: Date;
  status: string;
}): string {
  if (status === "final") {
    return "FT";
  }

  if (status === "postponed") {
    return "Postponed";
  }

  if (status === "halftime") {
    return "HT";
  }

  const kickoffMs = new Date(kickoffAt).getTime();

  if (Number.isNaN(kickoffMs) || now.getTime() < kickoffMs) {
    return "Not started";
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - kickoffMs) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function shouldShowMatchClock(status: string): status is MatchStatus {
  return status === "live" || status === "halftime" || status === "final";
}
