import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUpcomingMatches, type AppMatch } from "@/features/matches/data";
import { getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSessions } from "@/features/players/session";

export type RoomSummary = {
  exists: boolean;
  id: string;
  inviteCode?: string;
  name: string;
  slug: string;
  members: Array<{
    name: string;
    initials: string;
    status: string;
    tone: string;
  }>;
};

export type PlayerRoomShortcut = {
  name: string;
  slug: string;
  href: string;
  nextMatchLabel: string;
  nextMatchHref: string;
  nextMatch?: Pick<AppMatch, "awayTeam" | "homeTeam">;
  savedCount: number;
  score: number;
};

const fallbackRoom: RoomSummary = {
  exists: true,
  id: "fallback-room",
  inviteCode: "TIGER7",
  name: "World Cup Room",
  slug: "world-cup-room",
  members: [
    { name: "John Doe", initials: "JD", status: "Admin", tone: "gold" },
    { name: "Jane Doe", initials: "JD", status: "Joined", tone: "green" },
    { name: "Alex Doe", initials: "AD", status: "Joined", tone: "blue" },
    { name: "Sam Doe", initials: "SD", status: "Joined", tone: "red" }
  ]
};

export async function getRoomSummary(slug: string): Promise<RoomSummary> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return { ...fallbackRoom, slug, name: titleFromSlug(slug) };
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return emptyRoom(slug);
  }

  try {
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("slug", slug).single();

    if (roomError || !room) {
      return emptyRoom(slug);
    }

    const { data: memberships, error: memberError } = await supabase
      .from("room_members")
      .select("role, players(display_name, avatar_initials, avatar_color)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (memberError || !memberships) {
      return { exists: true, id: room.id, name: room.name, slug: room.slug, members: [] };
    }

    return {
      id: room.id,
      exists: true,
      inviteCode: typeof room.invite_code === "string" ? room.invite_code : undefined,
      name: room.name,
      slug: room.slug,
      members: dedupeRoomMembers(memberships).map((member, index) => ({
        ...member,
        tone: index === 0 ? "gold" : index === 2 ? "blue" : index === 3 ? "red" : "green"
      }))
    };
  } catch {
    return emptyRoom(slug);
  }
}

function dedupeRoomMembers(
  memberships: Array<{
    role: string;
    players:
      | {
          avatar_initials: string | null;
          display_name: string | null;
        }
      | Array<{
          avatar_initials: string | null;
          display_name: string | null;
        }>
      | null;
  }>
): Array<Omit<RoomSummary["members"][number], "tone">> {
  const membersByName = new Map<string, Omit<RoomSummary["members"][number], "tone">>();

  for (const membership of memberships) {
    const player = Array.isArray(membership.players) ? membership.players[0] : membership.players;
    const name = normalizeDisplayName(player?.display_name ?? "Player");
    const nameKey = playerNameKey(name);
    const currentMember = membersByName.get(nameKey);
    const nextMember = {
      name,
      initials: normalizeDisplayName(player?.avatar_initials ?? "GB"),
      status: membership.role === "admin" ? "Admin" : "Joined"
    };

    if (!currentMember) {
      membersByName.set(nameKey, nextMember);
      continue;
    }

    if (nextMember.status === "Admin" && currentMember.status !== "Admin") {
      membersByName.set(nameKey, { ...currentMember, status: "Admin" });
    }
  }

  return Array.from(membersByName.values());
}

export async function getCurrentPlayerRoomShortcuts(): Promise<PlayerRoomShortcut[]> {
  const matches = await getUpcomingMatches();
  const openMatchIds = getOpenPredictionMatchIds(matches);
  const nextMatch = matches.find((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId)) ?? matches[0];

  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return [
      {
        name: "World Cup Room",
        slug: "world-cup-room",
        href: "/r/world-cup-room",
        nextMatchLabel: nextMatch ? `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}` : "Next fixture",
        nextMatchHref: nextMatch ? `/r/world-cup-room/matches/${nextMatch.apiMatchId}` : "/r/world-cup-room/matches",
        nextMatch: nextMatch ? { awayTeam: nextMatch.awayTeam, homeTeam: nextMatch.homeTeam } : undefined,
        savedCount: 3,
        score: 44
      }
    ];
  }

  const [sessions, supabase] = await Promise.all([getPlayerSessions(), Promise.resolve(getSupabaseAdmin())]);

  if (sessions.length === 0 || !supabase) {
    return [];
  }

  try {
    const roomIds = sessions.map((session) => session.roomId);
    const playerIds = sessions.map((session) => session.playerId);
    const { data: rooms } = await supabase.from("rooms").select("id, name, slug").in("id", roomIds);

    if (!rooms?.length) {
      return [];
    }

    const { data: predictions } = await supabase
      .from("predictions")
      .select("player_id, score_total")
      .in("player_id", playerIds);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const predictionsByPlayerId = new Map<string, Array<{ score_total: number | null }>>();

    for (const prediction of predictions ?? []) {
      const playerPredictions = predictionsByPlayerId.get(prediction.player_id) ?? [];
      playerPredictions.push(prediction);
      predictionsByPlayerId.set(prediction.player_id, playerPredictions);
    }

    return sessions.flatMap((session) => {
      const room = roomById.get(session.roomId);

      if (!room) {
        return [];
      }

      const playerPredictions = predictionsByPlayerId.get(session.playerId) ?? [];

      return [{
        name: room.name,
        slug: room.slug,
        href: `/r/${room.slug}`,
        nextMatchLabel: nextMatch ? `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}` : "Next fixture",
        nextMatchHref: nextMatch ? `/r/${room.slug}/matches/${nextMatch.apiMatchId}` : `/r/${room.slug}/matches`,
        nextMatch: nextMatch ? { awayTeam: nextMatch.awayTeam, homeTeam: nextMatch.homeTeam } : undefined,
        savedCount: playerPredictions.length,
        score: playerPredictions.reduce((total, prediction) => total + (prediction.score_total ?? 0), 0)
      }];
    });
  } catch {
    return [];
  }
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function playerNameKey(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

function emptyRoom(slug: string): RoomSummary {
  return {
    exists: false,
    id: "",
    name: titleFromSlug(slug),
    slug,
    members: []
  };
}
