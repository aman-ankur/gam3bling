"use client";

import { type CSSProperties, useMemo, useState } from "react";
import type { MatchLineupView } from "@/features/match-details/types";

type LineupPitchProps = {
  lineups: MatchLineupView[];
};

export function LineupPitch({ lineups }: LineupPitchProps) {
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
              {lineup.teamName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="lineup-summary">
        <strong>{selectedLineup.teamName}</strong>
        <span>{selectedLineup.coachName ? `Coach: ${selectedLineup.coachName}` : "Starting XI"}</span>
      </div>

      {starters.length > 0 ? (
        <div className="football-pitch" aria-label={`${selectedLineup.teamName} formation`}>
          <span className="pitch-half-line" aria-hidden="true" />
          <span className="pitch-center-circle" aria-hidden="true" />
          {starters.map((player, index) => {
            const position = pitchPosition(player.grid, index, starters.length);

            return (
              <span
                className="pitch-player"
                key={`${player.playerName}-${player.sortOrder}`}
                style={{
                  "--player-left": `${position.left}%`,
                  "--player-top": `${position.top}%`
                } as CSSProperties}
              >
                <span className="pitch-shirt">{player.shirtNumber ?? index + 1}</span>
                <b>{player.playerName}</b>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="section-note">Lineups are not confirmed yet</p>
      )}

      <div className="lineup-player-list">
        {starters.slice(0, 6).map((player) => (
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

function PlayerRow({ player }: { player: MatchLineupView["players"][number] }) {
  return (
    <div className="lineup-player-row">
      <span>{player.shirtNumber ?? "-"}</span>
      <b>{player.playerName}</b>
      <small>{player.position ?? player.role}</small>
    </div>
  );
}

function pitchPosition(grid: string | null, index: number, total: number): { left: number; top: number } {
  if (grid?.includes(":")) {
    const [rowValue, columnValue] = grid.split(":").map(Number);

    if (Number.isFinite(rowValue) && Number.isFinite(columnValue)) {
      const rows = 5;
      const columns = columnCountForRow(rowValue, total);

      return {
        left: (columnValue / (columns + 1)) * 100,
        top: (rowValue / (rows + 1)) * 100
      };
    }
  }

  return {
    left: ((index % 4) + 1) * 20,
    top: 14 + Math.floor(index / 4) * 24
  };
}

function columnCountForRow(row: number, total: number): number {
  if (row <= 1 || row >= 5) {
    return 1;
  }

  if (row === 2) {
    return 4;
  }

  if (row === 3) {
    return total > 10 ? 2 : 3;
  }

  return 3;
}
