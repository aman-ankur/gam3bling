const RESULT_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

export type ResultCheckReason = "available" | "cooldown" | "early" | "final";

export type ResultCheckInput = {
  kickoffAt: string;
  lastSyncedAt?: string | null;
  stage?: string | null;
  status: string;
};

export type ResultCheckState = {
  canCheck: boolean;
  reason: ResultCheckReason;
  availableAt?: string;
  cooldownUntil?: string;
};

export function getResultCheckState(match: ResultCheckInput, now = new Date()): ResultCheckState {
  if (match.status === "final") {
    return {
      canCheck: false,
      reason: "final"
    };
  }

  const availableAt = new Date(match.kickoffAt);

  if (now.getTime() < availableAt.getTime()) {
    return {
      canCheck: false,
      reason: "early",
      availableAt: availableAt.toISOString()
    };
  }

  if (match.lastSyncedAt) {
    const cooldownUntil = new Date(new Date(match.lastSyncedAt).getTime() + RESULT_CHECK_COOLDOWN_MS);

    if (now.getTime() < cooldownUntil.getTime()) {
      return {
        canCheck: false,
        reason: "cooldown",
        cooldownUntil: cooldownUntil.toISOString()
      };
    }
  }

  return {
    canCheck: true,
    reason: "available"
  };
}
