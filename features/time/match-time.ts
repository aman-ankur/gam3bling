const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata"
});

export function formatKickoffInIst(kickoffAt: string | Date): string {
  const date = typeof kickoffAt === "string" ? new Date(kickoffAt) : kickoffAt;
  const formatted = IST_FORMATTER.format(date).replace(",", "").replace(/\s(am|pm)$/i, (period) =>
    period.toUpperCase()
  );
  const [day, month, time, period] = formatted.split(" ");

  return `${day} ${month}, ${time} ${period} IST`;
}

export function formatRefreshTimeInIst(refreshedAt: string | Date): string {
  const date = typeof refreshedAt === "string" ? new Date(refreshedAt) : refreshedAt;

  if (Number.isNaN(date.getTime())) {
    return "Last refreshed recently";
  }

  return `Last refreshed ${formatKickoffInIst(date)}`;
}

export function formatTimeToKickoff({
  now,
  kickoffAt
}: {
  now: Date;
  kickoffAt: Date;
}): string {
  const remainingMs = kickoffAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return "Locked";
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h to go`;
  }

  return `${hours}h ${minutes}m to go`;
}
