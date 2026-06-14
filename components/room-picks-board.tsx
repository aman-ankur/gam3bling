import { Avatar } from "@/components/avatar";
import type { RoomMatchPick } from "@/features/predictions/data";

type RoomPicksBoardProps = {
  picks: RoomMatchPick[];
};

export function RoomPicksBoard({ picks }: RoomPicksBoardProps) {
  const savedCount = picks.filter((pick) => pick.saved).length;

  return (
    <section className="section-stack room-picks" aria-labelledby="room-picks-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Room predictions</p>
          <h2 id="room-picks-title">Friends&apos; predictions</h2>
        </div>
        <span className="status-chip">{savedCount}/{picks.length} saved</span>
      </div>

      <div className="pick-list">
        {picks.map((pick) => (
          <article className={pick.isCurrentPlayer ? "pick-card mine" : "pick-card"} key={pick.playerId}>
            <div className="pick-player">
              <Avatar initials={pick.playerInitials} tone={pick.isCurrentPlayer ? "gold" : "green"} />
              <div>
                <b>{pick.playerName}</b>
                <small>{pick.isCurrentPlayer ? "You" : "Friend"}</small>
              </div>
              <span className={pick.saved ? "pick-status saved" : "pick-status waiting"}>{pick.saved ? "Saved" : "Waiting"}</span>
            </div>

            {pick.saved ? (
              <>
                <div className="pick-main">
                  <span className="score-pill">{pick.finalScore}</span>
                  <div>
                    <small>Result</small>
                    <strong>{pick.result}</strong>
                  </div>
                  <span className="points-pill">{pick.points} pts</span>
                </div>
                <dl className="pick-details">
                  <div>
                    <dt>Half-time</dt>
                    <dd>{pick.halftimeScore}</dd>
                  </div>
                  <div>
                    <dt>Scorers</dt>
                    <dd>{pick.scorers}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="empty-pick">
                <span>No prediction yet</span>
                <small>Waiting for predictions</small>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
