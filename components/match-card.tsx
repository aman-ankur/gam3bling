import Link from "next/link";
import { CountdownTimer } from "@/components/countdown-timer";
import { LiveMatchClock } from "@/components/live-match-clock";
import { MatchupName, TeamName } from "@/components/team-name";
import type { AppTeam } from "@/features/matches/data";
import { formatKickoffInIst } from "@/features/time/match-time";
import { formatMatchRankingLabel } from "@/features/teams/team-comparison";

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
  initialNow?: string;
  progress: string;
  metaLabel?: string;
  pickSummary?: string;
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
  initialNow,
  progress,
  metaLabel,
  pickSummary,
  featured = false,
  status = "open",
  variant = "standard"
}: MatchCardProps) {
  const matchTitle = `${homeTeam.name} vs ${awayTeam.name}`;
  const isLocked = status === "locked";
  const isLive = status === "live";
  const scoreText = homeScore != null && awayScore != null && (isLive || isLocked) ? `${homeScore}-${awayScore}` : null;
  const clockInitialNow = initialNow ?? new Date().toISOString();
  const kickoffLabel = isLive ? "Live now" : formatKickoffInIst(kickoffAt);
  const rankingLabel = formatMatchRankingLabel(homeTeam, awayTeam);
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
            <b className={scoreText ? "score-value" : "versus-value"}>{scoreText ?? "vs"}</b>
            <small>
              {isLive ? <LiveMatchClock initialNow={clockInitialNow} kickoffAt={kickoffAt} status="live" /> : formatKickoffInIst(kickoffAt)}
            </small>
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
          <div className="match-card-note">
            <small>{progress}</small>
            {pickSummary ? <span>Your pick: {pickSummary}</span> : null}
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
          {isLive ? <LiveMatchClock initialNow={clockInitialNow} kickoffAt={kickoffAt} status="live" /> : <CountdownTimer kickoffAt={kickoffAt} />}
        </strong>
      </div>
      <h3 aria-label={matchTitle}>
        <MatchupName awayTeam={awayTeam} homeTeam={homeTeam} />
      </h3>
      <div className="match-card-facts" aria-label={`${kickoffLabel}, ${rankingLabel}`}>
        <span>{kickoffLabel}</span>
        <span>{rankingLabel}</span>
        {scoreText ? <strong>{scoreText}</strong> : null}
      </div>
      <div className="match-action-row">
        <div className="match-card-note">
          <span className={`state-dot ${status}`}>{status}</span>
          <small>{progress}</small>
          {pickSummary ? <span>Your pick: {pickSummary}</span> : null}
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
