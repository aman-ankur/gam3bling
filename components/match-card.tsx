import Link from "next/link";
import { CountdownTimer } from "@/components/countdown-timer";
import { MatchupName, TeamName } from "@/components/team-name";
import type { AppTeam } from "@/features/matches/data";
import { formatKickoffInIst } from "@/features/time/match-time";

type MatchCardProps = {
  actionLabel?: string;
  ariaActionLabel?: string;
  href?: string;
  stage: string;
  kickoffAt: string;
  homeTeam: AppTeam;
  awayTeam: AppTeam;
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
  const matchTitle = `${homeTeam.name} vs ${awayTeam.name}`;
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
      <h3 aria-label={matchTitle}>
        <MatchupName awayTeam={awayTeam} homeTeam={homeTeam} />
      </h3>
      <p className="kickoff-line">{formatKickoffInIst(kickoffAt)}</p>
      <div className="fixture-row" aria-hidden="true">
        <strong>
          <TeamName team={homeTeam} />
        </strong>
        <span>vs</span>
        <strong>
          <TeamName team={awayTeam} />
        </strong>
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
