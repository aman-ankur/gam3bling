"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { TeamName } from "@/components/team-name";
import { getPitchPositions } from "@/features/match-details/pitch-layout";
import type { MatchLineupView } from "@/features/match-details/types";
import type { AppTeam } from "@/features/matches/data";

type LineupPitchProps = {
  lineups: MatchLineupView[];
  teams?: AppTeam[];
};

export function LineupPitch({ lineups, teams = [] }: LineupPitchProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(lineups[0]?.teamId ?? "");
  const selectedLineup = lineups.find((lineup) => lineup.teamId === selectedTeamId) ?? lineups[0];
  const starters = useMemo(
    () => (selectedLineup?.players ?? []).filter((player) => player.role === "starter").sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedLineup]
  );
  const substitutes = useMemo(
    () => (selectedLineup?.players ?? []).filter((player) => player.role === "substitute").sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedLineup]
  );
  const pitchPositions = useMemo(() => getPitchPositions(starters), [starters]);

  if (!selectedLineup) {
    return (
      <article className="section-stack match-detail-panel">
        <h2>Lineups</h2>
        <p className="section-note">Lineups are not confirmed yet</p>
      </article>
    );
  }

  return (
    <article className="section-stack match-detail-panel" aria-labelledby="lineups-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Team sheet</p>
          <h2 id="lineups-title">Lineups</h2>
        </div>
        {selectedLineup.formation ? <span className="status-chip">{selectedLineup.formation}</span> : null}
      </div>

      {lineups.length > 1 ? (
        <div className="lineup-team-toggle" aria-label="Choose lineup team">
          {lineups.map((lineup) => (
            <button
              className={lineup.teamId === selectedLineup.teamId ? "active" : ""}
              key={lineup.teamId}
              onClick={() => setSelectedTeamId(lineup.teamId)}
              type="button"
            >
              <LineupTeamName lineup={lineup} teams={teams} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="lineup-summary">
        <strong>
          <LineupTeamName lineup={selectedLineup} teams={teams} />
        </strong>
        <span>{selectedLineup.coachName ? `Coach: ${selectedLineup.coachName}` : "Starting XI"}</span>
      </div>

      {starters.length > 0 ? (
        <div className="football-pitch" aria-label={`${selectedLineup.teamName} formation`}>
          <span className="pitch-half-line" aria-hidden="true" />
          <span className="pitch-center-circle" aria-hidden="true" />
          {pitchPositions.map((position, index) => (
            <span
              className="pitch-player"
              key={`${position.player.playerName}-${position.player.sortOrder}`}
              style={{
                "--player-left": `${position.left}%`,
                "--player-top": `${position.top}%`
              } as CSSProperties}
            >
              <span className="pitch-shirt">{position.player.shirtNumber ?? index + 1}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="section-note">Lineups are not confirmed yet</p>
      )}

      <div className="lineup-player-list">
        {starters.map((player) => (
          <PlayerRow key={`${player.playerName}-starter`} player={player} />
        ))}
      </div>

      {substitutes.length > 0 ? (
        <details className="substitute-list">
          <summary>Substitutes</summary>
          <div className="lineup-player-list">
            {substitutes.map((player) => (
              <PlayerRow key={`${player.playerName}-sub`} player={player} />
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function LineupTeamName({ lineup, teams }: { lineup: MatchLineupView; teams: AppTeam[] }) {
  const team = teams.find((candidate) => candidate.id === lineup.teamId);

  return team ? <TeamName team={team} /> : <span>{lineup.teamName}</span>;
}

function PlayerRow({ player }: { player: MatchLineupView["players"][number] }) {
  return (
    <div className="lineup-player-row">
      <span>{player.shirtNumber ?? "-"}</span>
      <b>{player.playerName}</b>
      <small>{player.position ?? player.role}</small>
    </div>
  );
}
