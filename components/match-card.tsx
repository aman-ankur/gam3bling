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
  homeScore?: number | null;
  awayScore?: number | null;
  progress: string;
  metaLabel?: string;
  featured?: boolean;
  status?: "open" | "locked" | "live";
  variant?: "standard" | "sport";
};

export function MatchCard({
  actionLabel = "Predict",
  ariaActionLabel,
  href,
  stage,
  kickoffAt,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  progress,
  metaLabel,
  featured = false,
  status = "open",
  variant = "standard"
}: MatchCardProps) {
  const matchTitle = `${homeTeam.name} vs ${awayTeam.name}`;
  const scoreText = homeScore != null && awayScore != null ? `${homeScore}-${awayScore}` : null;
  const isLocked = status === "locked";
  const isLive = status === "live";
  const className = [
    "match-ticket",
    "match-card",
    variant === "sport" ? "sport-card" : "",
    featured ? "featured" : "",
    isLocked ? "locked" : ""
  ].filter(Boolean).join(" ");

  if (variant === "sport") {
    return (
      <article className={className}>
        <div className="ticket-meta">
          <div>
            <span>{stage}</span>
            <small>{metaLabel ?? "Predictions open"}</small>
          </div>
          <strong>
            {isLive ? "Live now" : <CountdownTimer kickoffAt={kickoffAt} />}
          </strong>
        </div>
        <div className="sport-matchup" aria-label={matchTitle}>
          <div className="sport-team">
            <TeamName team={homeTeam} />
          </div>
          <div className="center-lock">
            <b>{scoreText ?? "vs"}</b>
            <small>{formatKickoffInIst(kickoffAt)}</small>
          </div>
          <div className="sport-team">
            <TeamName team={awayTeam} />
          </div>
        </div>
        <div className="match-energy-bars" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="match-action-row">
          <div>
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
        <span>{scoreText ?? "vs"}</span>
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
