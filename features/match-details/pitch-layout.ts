import type { MatchLineupPlayerView } from "./types";

export type PitchPosition = {
  player: MatchLineupPlayerView;
  left: number;
  top: number;
};

const MIN_EDGE_PERCENT = 10;
const MAX_EDGE_PERCENT = 90;

export function getPitchPositions(players: MatchLineupPlayerView[]): PitchPosition[] {
  const parsed = players.map((player, index) => ({
    player,
    index,
    grid: parseGrid(player.grid)
  }));
  const rows = parsed
    .map((entry) => entry.grid?.row)
    .filter((row): row is number => typeof row === "number");
  const maxRow = Math.max(...rows, 5);
  const rowColumnCounts = new Map<number, number>();

  for (const entry of parsed) {
    if (!entry.grid) {
      continue;
    }

    rowColumnCounts.set(entry.grid.row, Math.max(rowColumnCounts.get(entry.grid.row) ?? 0, entry.grid.column));
  }

  return parsed.map((entry) => {
    if (!entry.grid) {
      return fallbackPosition(entry.player, entry.index);
    }

    const columnCount = Math.max(rowColumnCounts.get(entry.grid.row) ?? 1, 1);

    return {
      player: entry.player,
      left: clampPercent((entry.grid.column / (columnCount + 1)) * 100),
      top: clampPercent((entry.grid.row / (maxRow + 1)) * 100)
    };
  });
}

function parseGrid(grid: string | null): { row: number; column: number } | null {
  if (!grid?.includes(":")) {
    return null;
  }

  const [row, column] = grid.split(":").map(Number);

  if (!Number.isFinite(row) || !Number.isFinite(column) || row <= 0 || column <= 0) {
    return null;
  }

  return { row, column };
}

function fallbackPosition(player: MatchLineupPlayerView, index: number): PitchPosition {
  return {
    player,
    left: 20 + (index % 4) * 20,
    top: 14 + Math.floor(index / 4) * 24
  };
}

function clampPercent(value: number): number {
  return Math.max(MIN_EDGE_PERCENT, Math.min(MAX_EDGE_PERCENT, value));
}
