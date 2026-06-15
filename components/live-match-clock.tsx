"use client";

import { useEffect, useState } from "react";
import { getMatchClockLabel, shouldShowMatchClock } from "@/features/matches/live-clock";

type LiveMatchClockProps = {
  kickoffAt: string;
  initialNow: string;
  status: string;
};

export function LiveMatchClock({ kickoffAt, initialNow, status }: LiveMatchClockProps) {
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    if (!shouldShowMatchClock(status)) {
      return undefined;
    }

    const interval = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(interval);
  }, [status]);

  if (!shouldShowMatchClock(status)) {
    return null;
  }

  return (
    <span className="live-match-clock" aria-label={`Match clock ${getMatchClockLabel({ kickoffAt, now, status })}`}>
      {getMatchClockLabel({ kickoffAt, now, status })}
    </span>
  );
}
