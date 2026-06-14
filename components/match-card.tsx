import Link from "next/link";
import { CountdownTimer } from "@/components/countdown-timer";
import { formatKickoffInIst } from "@/features/time/match-time";

type MatchCardProps = {
  actionLabel?: string;
  ariaActionLabel?: string;
  href?: string;
  stage: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  progress: string;
  featured?: boolean;
  status?: "open" | "locked" | "live";
};

export function MatchCard({
  actionLabel = "Predict",
  ariaActionLabel,
  href,
  stage,
  kickoffAt,
  homeTeam,
  awayTeam,
  progress,
  featured = false,
  status = "open"
}: MatchCardProps) {
  const matchTitle = `${homeTeam} vs ${awayTeam}`;
  const isLocked = status === "locked";
  const className = [
    "match-ticket",
    "match-card",
    featured ? "featured" : "",
    isLocked ? "locked" : ""
  ].filter(Boolean).join(" ");

  return (
    <article className={className}>
      <div className="ticket-meta">
        <span>{stage}</span>
        <strong>
          <CountdownTimer kickoffAt={kickoffAt} />
        </strong>
      </div>
      <h3>{matchTitle}</h3>
      <p className="kickoff-line">{formatKickoffInIst(kickoffAt)}</p>
      <div className="fixture-row" aria-hidden="true">
        <strong>{homeTeam}</strong>
        <span>vs</span>
        <strong>{awayTeam}</strong>
      </div>
      <div className="match-action-row">
        <div>
          <span className={`state-dot ${status}`}>{status}</span>
          <small>{progress}</small>
        </div>
        {href && !isLocked ? (
          <Link aria-label={ariaActionLabel ?? `${actionLabel} ${matchTitle}`} className="card-link" href={href}>
            {actionLabel}
          </Link>
        ) : (
          <span aria-label={`${matchTitle} locked`} className="card-link disabled">
            Locked
          </span>
        )}
      </div>
    </article>
  );
}
