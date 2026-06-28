import { Avatar } from "@/components/avatar";
import type { AppTeam } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";

type RoomPicksBoardProps = {
  awayTeam: AppTeam;
  eyebrow?: string;
  homeTeam: AppTeam;
  picks: RoomMatchPick[];
  showResults?: boolean;
  title?: string;
};

export function RoomPicksBoard({ awayTeam, eyebrow = "Room predictions", homeTeam, picks, showResults = false, title = "Friends' predictions" }: RoomPicksBoardProps) {
  const savedCount = picks.filter((pick) => pick.saved).length;

  return (
    <section className="section-stack room-picks" aria-labelledby="room-picks-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="room-picks-title">{title}</h2>
        </div>
        <span className="status-chip">{savedCount}/{picks.length} saved</span>
      </div>

      {picks.length === 0 ? (
        <div className="empty-state" role="status">
          <strong>No room predictions yet</strong>
          <span>Friends&apos; predictions will appear here after they join and save.</span>
        </div>
      ) : (
        <div className="pick-list">
          {picks.map((pick) => (
          <article className={pick.isCurrentPlayer ? "pick-card mine" : "pick-card"} key={pick.playerId}>
            <div className="pick-player">
              <Avatar initials={pick.playerInitials} tone={pick.isCurrentPlayer ? "gold" : "green"} />
              <div>
                <b>{pick.playerName}</b>
                <small>
                  {pick.saved
                    ? pickSummaryText(awayTeam, homeTeam, pick)
                    : pick.isCurrentPlayer ? "You" : "Friend"}
                </small>
              </div>
              {pick.saved ? (
                <div className="pick-score-summary">
                  <strong>{pick.finalScore}</strong>
                  <small>{pick.points} pts</small>
                </div>
              ) : (
                <span className="pick-status waiting">Waiting</span>
              )}
            </div>

            {showResults && pick.saved ? <PickResultMarkers pick={pick} /> : null}
          </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PickResultMarkers({ pick }: { pick: RoomMatchPick }) {
  return (
    <div className="pick-result-markers" aria-label={`${pick.playerName} result breakdown`}>
      <ResultMarker label="Exact" points={pick.scoreFinal} />
      <ResultMarker label="Result" points={pick.scoreResult} />
      <ResultMarker label="HT" points={pick.scoreHalftime} />
      <ResultMarker label="First" points={pick.scoreFirstScorer} />
      <ResultMarker label="Last" points={pick.scoreLastScorer} />
      <ResultMarker label="Pens" points={pick.scorePenalty} />
    </div>
  );
}

function ResultMarker({ label, points }: { label: string; points: number }) {
  return (
    <span className={points > 0 ? "pick-result-marker hit" : "pick-result-marker"}>
      {points > 0 ? `${label} +${points}` : `${label} Miss`}
    </span>
  );
}

function pickSummaryText(awayTeam: AppTeam, homeTeam: AppTeam, pick: RoomMatchPick) {
  return [
    pickResultText(awayTeam, homeTeam, pick),
    pick.penaltyScore ? `Pens ${pick.penaltyScore}` : null,
    pick.halftimeScore ? `HT ${pick.halftimeScore}` : null,
    pick.firstScoringTeamId ? `First ${teamNameFromId(pick.firstScoringTeamId, homeTeam, awayTeam)}` : null,
    pick.lastScoringTeamId ? `Last ${teamNameFromId(pick.lastScoringTeamId, homeTeam, awayTeam)}` : null
  ].filter(Boolean).join(" · ");
}

function pickResultText(awayTeam: AppTeam, homeTeam: AppTeam, pick: RoomMatchPick) {
  if (pick.matchResult === "home") {
    return `${homeTeam.name} win`;
  }

  if (pick.matchResult === "away") {
    return `${awayTeam.name} win`;
  }

  return "Draw";
}

function teamNameFromId(teamId: string, homeTeam: AppTeam, awayTeam: AppTeam): string {
  if (teamId === homeTeam.id) {
    return homeTeam.name;
  }

  if (teamId === awayTeam.id) {
    return awayTeam.name;
  }

  return "None";
}
