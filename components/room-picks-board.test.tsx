import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RoomPicksBoard } from "@/components/room-picks-board";
import type { AppTeam } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const homeTeam: AppTeam = {
  id: "home",
  name: "Spain",
  shortCode: "ESP",
  flagCode: "ES"
};

const awayTeam: AppTeam = {
  id: "away",
  name: "Cape Verde",
  shortCode: "CPV",
  flagCode: "CV"
};

describe("RoomPicksBoard", () => {
  test("can show scored result markers for concluded matches", () => {
    const markup = renderToStaticMarkup(
      <RoomPicksBoard
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        picks={[buildPick()]}
        showResults
        title="Room predictions"
      />
    );

    expect(markup).toContain("Exact +10");
    expect(markup).toContain("Result +5");
    expect(markup).toContain("HT");
    expect(markup).toContain("Miss");
  });
});

function buildPick(): RoomMatchPick {
  return {
    playerId: "player-1",
    playerName: "Aankur",
    playerInitials: "AA",
    finalHomeScore: 2,
    finalAwayScore: 1,
    finalScore: "2-1",
    halftimeHomeScore: 1,
    halftimeAwayScore: 0,
    halftimeScore: "1-0",
    matchResult: "home",
    firstScoringTeamId: "home",
    lastScoringTeamId: "away",
    result: "Spain",
    scorers: "Spain first, Cape Verde last",
    scoreFinal: 10,
    scoreResult: 5,
    scoreHalftime: 0,
    scoreFirstScorer: 2,
    scoreLastScorer: 0,
    points: 17,
    saved: true,
    isCurrentPlayer: true
  };
}
