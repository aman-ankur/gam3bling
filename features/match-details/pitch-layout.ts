import type { MatchLineupPlayerView } from "./types";

export type PitchPosition = {
  player: MatchLineupPlayerView;
  left: number;
  top: number;
};

const MIN_EDGE_PERCENT = 10;
const MAX_EDGE_PERCENT = 90;

export function getPitchPositions(players: MatchLineupPlayerView[], formation?: string | null): PitchPosition[] {
  const parsed = players.map((player, index) => ({
    player,
    index,
    grid: parseGrid(player.grid)
  }));
  const hasProviderGrid = parsed.some((entry) => entry.grid);

  if (!hasProviderGrid) {
    return formationPositions(players, formation);
  }

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

function formationPositions(players: MatchLineupPlayerView[], formation?: string | null): PitchPosition[] {
  const rowCounts = formationRows(players, formation);
  const rows: MatchLineupPlayerView[][] = [];
  let playerIndex = 0;

  for (const count of rowCounts) {
    rows.push(players.slice(playerIndex, playerIndex + count));
    playerIndex += count;
  }

  if (playerIndex < players.length) {
    rows[rows.length - 1]?.push(...players.slice(playerIndex));
  }

  return rows.flatMap((row, rowIndex) => {
    const top = rowTop(rowIndex, rows.length);

    return row.map((player, columnIndex) => ({
      player,
      left: rowLeft(columnIndex, row.length),
      top
    }));
  });
}

function formationRows(players: MatchLineupPlayerView[], formation?: string | null): number[] {
  const parsed = (formation ?? "")
    .split("-")
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part) && part > 0);

  if (parsed.length > 0) {
    return [1, ...parsed];
  }

  const keeperCount = Math.max(players.filter((player) => normalizePosition(player.position).includes("G")).length, 1);
  const defenderCount = players.filter((player) => /D|B/.test(normalizePosition(player.position))).length;
  const forwardCount = players.filter((player) => /F|W|ST|CF/.test(normalizePosition(player.position))).length;
  const midfielderCount = Math.max(players.length - keeperCount - defenderCount - forwardCount, 0);

  return [keeperCount, defenderCount, midfielderCount, forwardCount].filter((count) => count > 0);
}

function rowTop(rowIndex: number, rowCount: number): number {
  if (rowCount <= 1) {
    return 50;
  }

  return 88 - (rowIndex / (rowCount - 1)) * 66;
}

function rowLeft(columnIndex: number, columnCount: number): number {
  if (columnCount <= 1) {
    return 50;
  }

  const min = columnCount >= 4 ? 16 : 22;
  const max = 100 - min;

  return min + (columnIndex / (columnCount - 1)) * (max - min);
}

function normalizePosition(position: string | null): string {
  return (position ?? "").toUpperCase();
}

function clampPercent(value: number): number {
  return Math.max(MIN_EDGE_PERCENT, Math.min(MAX_EDGE_PERCENT, value));
}
