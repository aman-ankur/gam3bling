type PredictionLockInput = {
  now: Date;
  kickoffAt: Date;
  status?: string | null;
};

const STARTED_STATUSES = new Set(["live", "halftime", "final"]);

export function isPredictionLocked({ now, kickoffAt, status }: PredictionLockInput): boolean {
  return STARTED_STATUSES.has(status ?? "") || now.getTime() >= kickoffAt.getTime();
}
