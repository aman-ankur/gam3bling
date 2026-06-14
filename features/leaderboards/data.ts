import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  initials: string;
  score: number;
  secondaryStat: string;
  tone?: string;
};

const fallbackRoomLeaders: LeaderboardEntry[] = [
  { rank: 1, name: "John Doe", initials: "JD", score: 48, secondaryStat: "3 exact scores", tone: "gold" },
  { rank: 2, name: "Jane Doe", initials: "JD", score: 44, secondaryStat: "7 result hits", tone: "green" },
  { rank: 3, name: "Alex Doe", initials: "AD", score: 39, secondaryStat: "2 scorer bonuses", tone: "blue" },
  { rank: 4, name: "Sam Doe", initials: "SD", score: 32, secondaryStat: "5 saved predictions", tone: "red" }
];

const fallbackGlobalLeaders: LeaderboardEntry[] = [
  { rank: 1, name: "John Doe", initials: "JD", score: 71, secondaryStat: "Top 1%", tone: "gold" },
  { rank: 2, name: "Jane Doe", initials: "JD", score: 48, secondaryStat: "Top 11%", tone: "green" },
  { rank: 3, name: "Alex Doe", initials: "AD", score: 44, secondaryStat: "Top 14%", tone: "blue" },
  { rank: 4, name: "Sam Doe", initials: "SD", score: 39, secondaryStat: "Top 19%", tone: "red" }
];

export async function getRoomLeaderboard(roomSlug: string): Promise<LeaderboardEntry[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackRoomLeaders;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return fallbackRoomLeaders;
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id").eq("slug", roomSlug).single();

    if (!room) {
      return fallbackRoomLeaders;
    }

    const { data: members } = await supabase
      .from("room_members")
      .select("player_id, players(display_name, avatar_initials)")
      .eq("room_id", room.id);

    if (!members?.length) {
      return fallbackRoomLeaders;
    }

    const playerIds = members.map((member) => member.player_id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("player_id, score_total")
      .in("player_id", playerIds);

    return rankEntries(
      members.map((member) => {
        const player = Array.isArray(member.players) ? member.players[0] : member.players;
        const playerPredictions = predictions?.filter((prediction) => prediction.player_id === member.player_id) ?? [];

        return {
          name: player?.display_name ?? "Player",
          initials: player?.avatar_initials ?? "GB",
          score: sumScores(playerPredictions),
          secondaryStat: `${playerPredictions.length} saved predictions`
        };
      })
    );
  } catch {
    return fallbackRoomLeaders;
  }
}

export async function getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackGlobalLeaders;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return fallbackGlobalLeaders;
  }

  try {
    const [{ data: players }, { data: predictions }] = await Promise.all([
      supabase.from("players").select("id, display_name, avatar_initials").limit(100),
      supabase.from("predictions").select("player_id, score_total")
    ]);

    if (!players?.length) {
      return fallbackGlobalLeaders;
    }

    return rankEntries(
      players.map((player) => {
        const playerPredictions = predictions?.filter((prediction) => prediction.player_id === player.id) ?? [];

        return {
          name: player.display_name,
          initials: player.avatar_initials,
          score: sumScores(playerPredictions),
          secondaryStat: `${playerPredictions.length} saved predictions`
        };
      })
    );
  } catch {
    return fallbackGlobalLeaders;
  }
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
