import { Avatar } from "@/components/avatar";
import type { AppTeam } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";

type RoomPicksBoardProps = {
  awayTeam: AppTeam;
  eyebrow?: string;
  homeTeam: AppTeam;
  picks: RoomMatchPick[];
  title?: string;
};

export function RoomPicksBoard({ awayTeam, eyebrow = "Room predictions", homeTeam, picks, title = "Friends' predictions" }: RoomPicksBoardProps) {
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
                    ? `${pick.isCurrentPlayer ? "You" : "Friend"} - ${pickSummaryText(awayTeam, homeTeam, pick)}`
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

          </article>
          ))}
        </div>
      )}
    </section>
  );
}

function pickSummaryText(awayTeam: AppTeam, homeTeam: AppTeam, pick: RoomMatchPick) {
  return `${pickResultText(awayTeam, homeTeam, pick)}, HT ${pick.halftimeScore}`;
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
