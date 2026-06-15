import { expect, test } from "vitest";
import { getRoomScoreRows } from "./room-score-preview";

test("shows every room leaderboard player in the room score preview", () => {
  const rows = getRoomScoreRows([
    { playerId: "amanwa", rank: 1, name: "Amanwa", initials: "A", score: 0, secondaryStat: "0 saved" },
    { playerId: "declan", rank: 2, name: "Declan Rice", initials: "DR", score: 0, secondaryStat: "0 saved" },
    { playerId: "kamesh", rank: 3, name: "Kamesh", initials: "K", score: 0, secondaryStat: "0 saved" },
    { playerId: "karn", rank: 4, name: "Karn", initials: "K", score: 0, secondaryStat: "0 saved" },
    { playerId: "player", rank: 5, name: "Player", initials: "P", score: 0, secondaryStat: "0 saved" }
  ]);

  expect(rows.map((row) => row.name)).toEqual(["Amanwa", "Declan Rice", "Kamesh", "Karn", "Player"]);
});
