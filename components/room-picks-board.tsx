import { Avatar } from "@/components/avatar";
import { TeamName } from "@/components/team-name";
import type { AppTeam } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";

type RoomPicksBoardProps = {
  awayTeam: AppTeam;
  homeTeam: AppTeam;
  picks: RoomMatchPick[];
};

export function RoomPicksBoard({ awayTeam, homeTeam, picks }: RoomPicksBoardProps) {
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
                    <strong>
                      <PickResult awayTeam={awayTeam} homeTeam={homeTeam} pick={pick} />
                    </strong>
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
                    <dd>
                      <PickScorers awayTeam={awayTeam} homeTeam={homeTeam} pick={pick} />
                    </dd>
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
      )}
    </section>
  );
}

function PickResult({ awayTeam, homeTeam, pick }: { awayTeam: AppTeam; homeTeam: AppTeam; pick: RoomMatchPick }) {
  if (pick.matchResult === "home") {
    return <TeamName team={homeTeam} />;
  }

  if (pick.matchResult === "away") {
    return <TeamName team={awayTeam} />;
  }

  return <span>Draw</span>;
}

function PickScorers({ awayTeam, homeTeam, pick }: { awayTeam: AppTeam; homeTeam: AppTeam; pick: RoomMatchPick }) {
  const firstTeam = teamFromId(pick.firstScoringTeamId, homeTeam, awayTeam);
  const lastTeam = teamFromId(pick.lastScoringTeamId, homeTeam, awayTeam);

  if (!firstTeam || !lastTeam) {
    return <span>No goals</span>;
  }

  return (
    <span className="inline-team-sequence">
      <TeamName team={firstTeam} />
      <span>first,</span>
      <TeamName team={lastTeam} />
      <span>last</span>
    </span>
  );
}

function teamFromId(teamId: string | undefined, homeTeam: AppTeam, awayTeam: AppTeam): AppTeam | null {
  if (teamId === homeTeam.id) {
    return homeTeam;
  }

  if (teamId === awayTeam.id) {
    return awayTeam;
  }

  return null;
}
