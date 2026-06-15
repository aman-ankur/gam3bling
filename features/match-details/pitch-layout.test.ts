import { describe, expect, test } from "vitest";
import { getPitchPositions } from "./pitch-layout";
import type { MatchLineupPlayerView } from "./types";

describe("getPitchPositions", () => {
  test("keeps all API grid columns inside the pitch bounds", () => {
    const players = [
      player("Keeper", "1:1"),
      player("Defender 1", "2:1"),
      player("Defender 2", "2:2"),
      player("Defender 3", "2:3"),
      player("Midfielder 1", "3:1"),
      player("Midfielder 2", "3:2"),
      player("Midfielder 3", "3:3"),
      player("Midfielder 4", "3:4"),
      player("Forward 1", "4:1"),
      player("Forward 2", "4:2"),
      player("Striker", "5:1")
    ];

    const positions = getPitchPositions(players);

    expect(positions).toHaveLength(players.length);
    expect(positions.every((position) => position.left >= 8 && position.left <= 92)).toBe(true);
    expect(positions.every((position) => position.top >= 8 && position.top <= 92)).toBe(true);
    expect(positions.find((position) => position.player.playerName === "Midfielder 4")?.left).toBeLessThan(92);
  });

  test("builds realistic rows from formation when ESPN grid slots are single values", () => {
    const players = [
      player("Keeper", "1", "G"),
      player("Right Back", "2", "D"),
      player("Center Back 1", "3", "D"),
      player("Center Back 2", "4", "D"),
      player("Left Back", "5", "D"),
      player("Midfielder 1", "6", "M"),
      player("Midfielder 2", "7", "M"),
      player("Midfielder 3", "8", "M"),
      player("Forward 1", "9", "F"),
      player("Forward 2", "10", "F"),
      player("Forward 3", "11", "F")
    ];

    const positions = getPitchPositions(players, "4-3-3");

    expect(positions.find((position) => position.player.playerName === "Keeper")?.top).toBeGreaterThan(80);
    expect(positions.filter((position) => position.top === positions[1].top)).toHaveLength(4);
    expect(positions.find((position) => position.player.playerName === "Forward 2")?.top).toBeLessThan(40);
  });
});

function player(playerName: string, grid: string, position: string | null = null): MatchLineupPlayerView {
  return {
    playerName,
    shirtNumber: null,
    position,
    grid,
    role: "starter",
    sortOrder: 0
  };
}
