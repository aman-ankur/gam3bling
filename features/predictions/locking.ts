type PredictionLockInput = {
  now: Date;
  kickoffAt: Date;
};

export function isPredictionLocked({ now, kickoffAt }: PredictionLockInput): boolean {
  return now.getTime() >= kickoffAt.getTime();
}
