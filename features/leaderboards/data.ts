import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LeaderboardEntry = {
  playerId?: string;
  rank: number;
  name: string;
  initials: string;
  score: number;
  secondaryStat: string;
  tone?: string;
};

type RoomLeaderboardMember = {
  player_id: string;
  players:
    | {
        display_name: string;
        avatar_initials: string;
      }
    | Array<{
        display_name: string;
        avatar_initials: string;
      }>
    | null;
};

type LeaderboardPrediction = {
  match_id?: string;
  player_id: string;
  score_total: number | null;
  submitted_at?: string;
};

const fallbackRoomLeaders: LeaderboardEntry[] = [
  { playerId: "fallback-john", rank: 1, name: "John Doe", initials: "JD", score: 48, secondaryStat: "3 exact scores", tone: "gold" },
  { playerId: "fallback-jane", rank: 2, name: "Jane Doe", initials: "JD", score: 44, secondaryStat: "7 result hits", tone: "green" },
  { playerId: "fallback-alex", rank: 3, name: "Alex Doe", initials: "AD", score: 39, secondaryStat: "2 scorer bonuses", tone: "blue" },
  { playerId: "fallback-sam", rank: 4, name: "Sam Doe", initials: "SD", score: 32, secondaryStat: "5 saved predictions", tone: "red" }
];

const fallbackGlobalLeaders: LeaderboardEntry[] = [
  { playerId: "fallback-john", rank: 1, name: "John Doe", initials: "JD", score: 71, secondaryStat: "Top 1%", tone: "gold" },
  { playerId: "fallback-jane", rank: 2, name: "Jane Doe", initials: "JD", score: 48, secondaryStat: "Top 11%", tone: "green" },
  { playerId: "fallback-alex", rank: 3, name: "Alex Doe", initials: "AD", score: 44, secondaryStat: "Top 14%", tone: "blue" },
  { playerId: "fallback-sam", rank: 4, name: "Sam Doe", initials: "SD", score: 39, secondaryStat: "Top 19%", tone: "red" }
];

export async function getRoomLeaderboard(roomSlug: string): Promise<LeaderboardEntry[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackRoomLeaders;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id").eq("slug", roomSlug).single();

    if (!room) {
      return [];
    }

    const { data: members } = await supabase
      .from("room_members")
      .select("player_id, players(display_name, avatar_initials)")
      .eq("room_id", room.id);

    if (!members?.length) {
      return [];
    }

    const playerIds = members.map((member) => member.player_id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id, player_id, score_total, submitted_at")
      .in("player_id", playerIds);

    return rankEntries(buildRoomLeaderboardEntries(members, predictions ?? []));
  } catch {
    return [];
  }
}

export async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackGlobalLeaders;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  try {
    const [{ data: players }, { data: predictions }] = await Promise.all([
      supabase.from("players").select("id, display_name, avatar_initials").limit(100),
      supabase.from("predictions").select("player_id, score_total")
    ]);

    if (!players?.length) {
      return [];
    }

    return rankEntries(
      players.map((player) => {
        const playerPredictions = predictions?.filter((prediction) => prediction.player_id === player.id) ?? [];

        return {
          playerId: player.id,
          name: player.display_name,
          initials: player.avatar_initials,
          score: sumScores(playerPredictions),
          secondaryStat: `${playerPredictions.length} saved predictions`
        };
      })
    );
  } catch {
    return [];
  }
}

function buildRoomLeaderboardEntries(
  members: RoomLeaderboardMember[],
  predictions: LeaderboardPrediction[]
): Array<Omit<LeaderboardEntry, "rank" | "tone">> {
  const predictionsByPlayerId = groupPredictionsByPlayerId(predictions);
  const membersByName = new Map<string, RoomLeaderboardMember[]>();

  for (const member of members) {
    const player = Array.isArray(member.players) ? member.players[0] : member.players;
    const nameKey = playerNameKey(player?.display_name ?? "Player");
    const nameMembers = membersByName.get(nameKey) ?? [];
    nameMembers.push(member);
    membersByName.set(nameKey, nameMembers);
  }

  return Array.from(membersByName.values()).map((nameMembers) => {
    const displayMember = chooseDisplayMember(nameMembers, predictionsByPlayerId);
    const player = Array.isArray(displayMember.players) ? displayMember.players[0] : displayMember.players;
    const latestPredictions = latestPredictionsByMatch(nameMembers.flatMap((member) => predictionsByPlayerId.get(member.player_id) ?? []));

    return {
      playerId: displayMember.player_id,
      name: normalizeDisplayName(player?.display_name ?? "Player"),
      initials: player?.avatar_initials ?? "GB",
      score: sumScores(latestPredictions),
      secondaryStat: `${latestPredictions.length} saved predictions`
    };
  });
}

function groupPredictionsByPlayerId(predictions: LeaderboardPrediction[]): Map<string, LeaderboardPrediction[]> {
  const predictionsByPlayerId = new Map<string, LeaderboardPrediction[]>();

  for (const prediction of predictions) {
    const playerPredictions = predictionsByPlayerId.get(prediction.player_id) ?? [];
    playerPredictions.push(prediction);
    predictionsByPlayerId.set(prediction.player_id, playerPredictions);
  }

  return predictionsByPlayerId;
}

function chooseDisplayMember(
  members: RoomLeaderboardMember[],
  predictionsByPlayerId: Map<string, LeaderboardPrediction[]>
): RoomLeaderboardMember {
  return members
    .slice()
    .sort((left, right) => latestPredictionMs(right, predictionsByPlayerId) - latestPredictionMs(left, predictionsByPlayerId))[0];
}

function latestPredictionMs(
  member: RoomLeaderboardMember,
  predictionsByPlayerId: Map<string, LeaderboardPrediction[]>
): number {
  return Math.max(0, ...(predictionsByPlayerId.get(member.player_id) ?? []).map((prediction) => submittedAtMs(prediction.submitted_at)));
}

function latestPredictionsByMatch(predictions: LeaderboardPrediction[]): LeaderboardPrediction[] {
  const predictionByMatchId = new Map<string, LeaderboardPrediction>();

  for (const prediction of predictions) {
    const matchId = prediction.match_id ?? `player:${prediction.player_id}`;
    const currentPrediction = predictionByMatchId.get(matchId);

    if (!currentPrediction || submittedAtMs(prediction.submitted_at) > submittedAtMs(currentPrediction.submitted_at)) {
      predictionByMatchId.set(matchId, prediction);
    }
  }

  return Array.from(predictionByMatchId.values());
}

function rankEntries(entries: Array<Omit<LeaderboardEntry, "rank" | "tone">>): LeaderboardEntry[] {
  return entries
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      tone: index === 0 ? "gold" : index === 2 ? "blue" : index === 3 ? "red" : "green"
    }));
}

function sumScores(predictions: Array<{ score_total: number | null }>): number {
  return predictions.reduce((total, prediction) => total + (prediction.score_total ?? 0), 0);
}

function playerNameKey(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

function submittedAtMs(submittedAt: string | undefined): number {
  return submittedAt ? new Date(submittedAt).getTime() : 0;
}
