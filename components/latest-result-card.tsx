import Link from "next/link";
import { TeamName } from "@/components/team-name";
import type { AppMatch } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";

type LatestResultCardProps = {
  match: AppMatch;
  picks: RoomMatchPick[];
  slug: string;
};

export function LatestResultCard({ match, picks, slug }: LatestResultCardProps) {
  const savedPicks = picks.filter((pick) => pick.saved);
  const currentPick = savedPicks.find((pick) => pick.isCurrentPlayer);
  const exactHits = savedPicks.filter((pick) => pick.scoreFinal > 0).length;
  const rankedPicks = savedPicks
    .slice()
    .sort((left, right) => right.points - left.points || left.playerName.localeCompare(right.playerName));

  return (
    <section className="latest-result-card" aria-labelledby="latest-result-title">
      <div className="latest-result-hero">
        <p className="eyebrow">Final just landed</p>
        <h2 id="latest-result-title">{resultHeadline(match)}</h2>
        <p>{currentPick ? `You earned ${currentPick.points} points.` : "Room scores are ready."} First and last scorer may stay pending until official event data is mapped.</p>
        <div className="latest-scoreline" aria-label={`${match.homeTeam.name} ${match.homeScore} ${match.awayTeam.name} ${match.awayScore}`}>
          <strong><TeamName team={match.homeTeam} /></strong>
          <b>{match.homeScore}-{match.awayScore}</b>
          <strong><TeamName team={match.awayTeam} /></strong>
        </div>
      </div>

      <div className="latest-return-card">
        <p className="eyebrow">Your return</p>
        <h3>Prediction settled</h3>
        <div className="latest-result-summary">
          <div>
            <span>Your points</span>
            <b>{currentPick ? `+${currentPick.points}` : "-"}</b>
          </div>
          <div>
            <span>Room rank</span>
            <b>{currentPick ? ordinalRank(rankedPicks.findIndex((pick) => pick.playerId === currentPick.playerId) + 1) : "-"}</b>
          </div>
          <div>
            <span>Hits</span>
            <b>{currentPick ? `${hitCount(currentPick)}/5` : `${exactHits}`}</b>
          </div>
        </div>
      </div>

      {savedPicks.length > 0 ? (
        <div className="latest-result-movers-card">
          <p className="eyebrow">Room score</p>
          <h3>Leaderboard movement</h3>
          <ol className="result-movers" aria-label="Latest result score changes">
            {rankedPicks
            .slice(0, 3)
            .map((pick, index) => (
              <li key={pick.playerId}>
                <span className="result-rank">{index + 1}</span>
                <span>{pick.playerName}</span>
                <small>{hitSummary(pick)}</small>
                <b>+{pick.points}</b>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Link className="latest-result-action" href={`/r/${slug}/matches/${match.apiMatchId}`}>
        <span>View full breakdown</span>
        <b>Open</b>
      </Link>
    </section>
  );
}

function resultHeadline(match: AppMatch): string {
  if (match.homeScore == null || match.awayScore == null) {
    return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  }

  if (match.homeScore > match.awayScore) {
    return `${match.homeTeam.name} beat ${match.awayTeam.name}`;
  }

  if (match.awayScore > match.homeScore) {
    return `${match.awayTeam.name} beat ${match.homeTeam.name}`;
  }

  return `${match.homeTeam.name} and ${match.awayTeam.name} drew`;
}

function hitSummary(pick: RoomMatchPick): string {
  const hits = [
    pick.scoreFinal > 0 ? "Exact" : null,
    pick.scoreResult > 0 ? "Result" : null,
    pick.scoreHalftime > 0 ? "HT" : null,
    pick.scoreFirstScorer > 0 ? "First scorer" : null,
    pick.scoreLastScorer > 0 ? "Last scorer" : null
  ].filter(Boolean);

  return hits.length > 0 ? hits.join(", ") : "No hits";
}

function hitCount(pick: RoomMatchPick): number {
  return [
    pick.scoreFinal,
    pick.scoreResult,
    pick.scoreHalftime,
    pick.scoreFirstScorer,
    pick.scoreLastScorer
  ].filter((points) => points > 0).length;
}

function ordinalRank(rank: number): string {
  if (rank <= 0) {
    return "-";
  }

  const suffix = rank % 10 === 1 && rank % 100 !== 11
    ? "st"
    : rank % 10 === 2 && rank % 100 !== 12
      ? "nd"
      : rank % 10 === 3 && rank % 100 !== 13
        ? "rd"
        : "th";

  return `${rank}${suffix}`;
}
