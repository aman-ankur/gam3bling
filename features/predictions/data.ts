import type { AppMatch } from "@/features/matches/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RoomMatchPick = {
  playerId: string;
  playerName: string;
  playerInitials: string;
  finalHomeScore?: number;
  finalAwayScore?: number;
  finalScore?: string;
  halftimeHomeScore?: number;
  halftimeAwayScore?: number;
  halftimeScore?: string;
  matchResult?: "home" | "away" | "draw";
  firstScoringTeamId?: string;
  lastScoringTeamId?: string;
  result?: string;
  scorers?: string;
  points: number;
  saved: boolean;
  isCurrentPlayer: boolean;
};

type InternalRoomMatchPick = RoomMatchPick & {
  joinedAt: string;
  nameKey: string;
  submittedAt?: string;
};

export async function getRoomMatchPicks(roomSlug: string, match: AppMatch): Promise<RoomMatchPick[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackPicks(match);
  }

  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

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
      .select("player_id, joined_at, players(display_name, avatar_initials)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (!members?.length) {
      return [];
    }

    const playerIds = members.map((member) => member.player_id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .eq("match_id", match.id)
      .in("player_id", playerIds);
    const predictionsByPlayer = new Map((predictions ?? []).map((prediction) => [prediction.player_id, prediction]));

    const picks = members.map((member): InternalRoomMatchPick => {
      const player = Array.isArray(member.players) ? member.players[0] : member.players;
      const prediction = predictionsByPlayer.get(member.player_id);
      const playerName = normalizeDisplayName(player?.display_name ?? "Player");

      return {
        playerId: member.player_id,
        playerName,
        playerInitials: player?.avatar_initials ?? "GB",
        finalHomeScore: prediction?.final_home_score,
        finalAwayScore: prediction?.final_away_score,
        finalScore: prediction ? `${prediction.final_home_score}-${prediction.final_away_score}` : undefined,
        halftimeHomeScore: prediction?.halftime_home_score,
        halftimeAwayScore: prediction?.halftime_away_score,
        halftimeScore: prediction ? `${prediction.halftime_home_score}-${prediction.halftime_away_score}` : undefined,
        matchResult: prediction?.match_result,
        firstScoringTeamId: prediction?.first_scoring_team_id ?? undefined,
        lastScoringTeamId: prediction?.last_scoring_team_id ?? undefined,
        result: prediction ? resultLabel(prediction.match_result, match) : undefined,
        scorers: prediction ? scorersLabel(prediction.first_scoring_team_id, prediction.last_scoring_team_id, match) : undefined,
        points: prediction?.score_total ?? 0,
        saved: Boolean(prediction),
        isCurrentPlayer: session?.playerId === member.player_id,
        joinedAt: member.joined_at,
        nameKey: playerNameKey(playerName),
        submittedAt: prediction?.submitted_at
      };
    });

    return dedupePicksByPlayerName(picks);
  } catch {
    return [];
  }
}

function dedupePicksByPlayerName(picks: InternalRoomMatchPick[]): RoomMatchPick[] {
  const groups = new Map<string, InternalRoomMatchPick[]>();

  for (const pick of picks) {
    const group = groups.get(pick.nameKey) ?? [];
    group.push(pick);
    groups.set(pick.nameKey, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const preferredPick = choosePreferredPick(group);

      return {
        joinedAt: preferredPick.joinedAt,
        pick: toPublicPick(preferredPick, group.some((candidate) => candidate.isCurrentPlayer))
      };
    })
    .sort((left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())
    .map(({ pick }) => pick);
}

function choosePreferredPick(group: InternalRoomMatchPick[]): InternalRoomMatchPick {
  const savedPicks = group.filter((pick) => pick.saved);

  if (savedPicks.length > 0) {
    return savedPicks.sort((left, right) => submittedAtMs(right.submittedAt) - submittedAtMs(left.submittedAt))[0];
  }

  return group.find((pick) => pick.isCurrentPlayer) ?? group[0];
}

function submittedAtMs(submittedAt: string | undefined): number {
  return submittedAt ? new Date(submittedAt).getTime() : 0;
}

function toPublicPick(pick: InternalRoomMatchPick, isCurrentPlayer: boolean): RoomMatchPick {
  return {
    playerId: pick.playerId,
    playerName: pick.playerName,
    playerInitials: pick.playerInitials,
    finalHomeScore: pick.finalHomeScore,
    finalAwayScore: pick.finalAwayScore,
    finalScore: pick.finalScore,
    halftimeHomeScore: pick.halftimeHomeScore,
    halftimeAwayScore: pick.halftimeAwayScore,
    halftimeScore: pick.halftimeScore,
    matchResult: pick.matchResult,
    firstScoringTeamId: pick.firstScoringTeamId,
    lastScoringTeamId: pick.lastScoringTeamId,
    result: pick.result,
    scorers: pick.scorers,
    points: pick.points,
    saved: pick.saved,
    isCurrentPlayer
  };
}

function playerNameKey(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

export async function getCurrentPlayerPredictedMatchIds(roomSlug: string, matches: AppMatch[]): Promise<Set<string>> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return new Set(["1489376", "30000000-0000-4000-8000-000000000002"]);
  }

  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

  if (!supabase || !session || matches.length === 0) {
    return new Set();
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id").eq("slug", roomSlug).single();

    if (!room) {
      return new Set();
    }

    const { data: membership } = await supabase
      .from("room_members")
      .select("player_id")
      .eq("room_id", room.id)
      .eq("player_id", session.playerId)
      .maybeSingle();

    if (!membership) {
      return new Set();
    }

    const matchIds = matches.map((match) => match.id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("player_id", session.playerId)
      .in("match_id", matchIds);

    return new Set((predictions ?? []).flatMap((prediction) => {
      const match = matches.find((candidate) => candidate.id === prediction.match_id);

      return match ? [match.id, match.apiMatchId] : [prediction.match_id];
    }));
  } catch {
    return new Set();
  }
}

function fallbackPicks(match: AppMatch): RoomMatchPick[] {
  return [
    {
      playerId: "fallback-john",
      playerName: "John Doe",
      playerInitials: "JD",
      finalHomeScore: 2,
      finalAwayScore: 1,
      finalScore: "2-1",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      halftimeScore: "1-0",
      matchResult: "home",
      firstScoringTeamId: match.homeTeam.id,
      lastScoringTeamId: match.awayTeam.id,
      result: match.homeTeam.name,
      scorers: `${match.homeTeam.name} first, ${match.awayTeam.name} last`,
      points: 0,
      saved: true,
      isCurrentPlayer: false
    },
    {
      playerId: "fallback-jane",
      playerName: "Jane Doe",
      playerInitials: "JD",
      points: 0,
      saved: false,
      isCurrentPlayer: true
    }
  ];
}

function resultLabel(result: string, match: AppMatch): string {
  if (result === "home") {
    return match.homeTeam.name;
  }

  if (result === "away") {
    return match.awayTeam.name;
  }

  return "Draw";
}

function scorersLabel(firstScoringTeamId: string | null, lastScoringTeamId: string | null, match: AppMatch): string {
  if (!firstScoringTeamId || !lastScoringTeamId) {
    return "No goals";
  }

  return `${teamName(firstScoringTeamId, match)} first, ${teamName(lastScoringTeamId, match)} last`;
}

function teamName(teamId: string, match: AppMatch): string {
  if (teamId === match.homeTeam.id) {
    return match.homeTeam.name;
  }

  if (teamId === match.awayTeam.id) {
    return match.awayTeam.name;
  }

  return "Unknown";
}
