"use client";

import { useEffect, useState } from "react";
import { formatTimeToKickoff } from "@/features/time/match-time";

type CountdownTimerProps = {
  kickoffAt: string;
};

export function CountdownTimer({ kickoffAt }: CountdownTimerProps) {
  const [label, setLabel] = useState(() =>
    formatTimeToKickoff({ now: new Date(), kickoffAt: new Date(kickoffAt) })
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLabel(formatTimeToKickoff({ now: new Date(), kickoffAt: new Date(kickoffAt) }));
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [kickoffAt]);

  return <span>{label}</span>;
}
