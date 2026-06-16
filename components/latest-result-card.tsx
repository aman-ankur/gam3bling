import Link from "next/link";
import { TeamName } from "@/components/team-name";
import type { AppMatch } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";
import { formatHistoryKickoffInIst } from "@/features/time/match-time";

type LatestResultCardProps = {
  match: AppMatch;
  picks: RoomMatchPick[];
  slug: string;
};

export function LatestResultCard({ match, picks, slug }: LatestResultCardProps) {
  const isSettled = match.status === "final" && match.homeScore != null && match.awayScore != null;
  const savedPicks = picks.filter((pick) => pick.saved);
  const currentPick = savedPicks.find((pick) => pick.isCurrentPlayer);
  const matchHref = `/r/${slug}/matches/${match.apiMatchId}`;
  const hasScore = match.homeScore != null && match.awayScore != null;
  const scoreText = hasScore ? `${match.homeScore}-${match.awayScore}` : "Pending";
  const pickText = currentPick?.finalScore ?? (
    currentPick?.finalHomeScore != null && currentPick.finalAwayScore != null
      ? `${currentPick.finalHomeScore}-${currentPick.finalAwayScore}`
      : "-"
  );
  const pointsText = isSettled && currentPick ? signedPoints(currentPick.points) : "Pending";

  return (
    <Link
      aria-label={`Open ${match.homeTeam.name} vs ${match.awayTeam.name} history`}
      className="latest-result-card latest-result-compact-card"
      href={matchHref}
    >
      <div className="history-card-main">
        <div>
          <span className="history-status-chip">{isSettled ? "Final" : "Pending"}</span>
          <strong className="history-matchup">
            <TeamName team={match.homeTeam} />
            <span className="history-vs">vs</span>
            <TeamName team={match.awayTeam} />
          </strong>
          <small className="history-kickoff-time">{formatHistoryKickoffInIst(match.kickoffAt)}</small>
        </div>
        <b className="history-card-score">{scoreText}</b>
      </div>

      <div className="history-card-meta">
        <div>
          <span>Your pick</span>
          <b>{pickText}</b>
        </div>
        <div>
          <span>Points</span>
          <b>{pointsText}</b>
        </div>
        <span className="history-open-label">Open</span>
      </div>
    </Link>
  );
}

function signedPoints(points: number): string {
  return `${points >= 0 ? "+" : ""}${points}`;
}
