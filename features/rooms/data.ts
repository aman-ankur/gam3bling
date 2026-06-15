import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUpcomingMatches, type AppMatch } from "@/features/matches/data";
import { getActiveMatchIds, getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSessions } from "@/features/players/session";

export type RoomSummary = {
  adminMembers?: RoomMemberSummary[];
  creatorPlayerId?: string;
  exists: boolean;
  id: string;
  inviteCode?: string;
  name: string;
  slug: string;
  members: RoomMemberSummary[];
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

export type RoomMemberSummary = {
  name: string;
  initials: string;
  playerId?: string;
  role: "admin" | "member";
  status: string;
  tone: string;
};

const fallbackRoom: RoomSummary = {
  creatorPlayerId: "fallback-john",
  exists: true,
  id: "fallback-room",
  inviteCode: "TIGER7",
  name: "World Cup Room",
  slug: "world-cup-room",
    members: [
    { name: "John Doe", initials: "JD", playerId: "fallback-john", role: "admin", status: "Admin", tone: "gold" },
    { name: "Jane Doe", initials: "JD", playerId: "fallback-jane", role: "member", status: "Joined", tone: "green" },
    { name: "Alex Doe", initials: "AD", playerId: "fallback-alex", role: "member", status: "Joined", tone: "blue" },
    { name: "Sam Doe", initials: "SD", playerId: "fallback-sam", role: "member", status: "Joined", tone: "red" }
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
      .select("player_id, role, players(display_name, avatar_initials, avatar_color)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (memberError || !memberships) {
      return { creatorPlayerId: room.creator_player_id ?? undefined, exists: true, id: room.id, name: room.name, slug: room.slug, members: [] };
    }

    const allMembers = mapRoomMembers(memberships);

    return {
      adminMembers: withMemberTones(allMembers),
      creatorPlayerId: room.creator_player_id ?? undefined,
      id: room.id,
      exists: true,
      inviteCode: typeof room.invite_code === "string" ? room.invite_code : undefined,
      name: room.name,
      slug: room.slug,
      members: withMemberTones(dedupeRoomMembers(allMembers))
    };
  } catch {
    return emptyRoom(slug);
  }
}

function mapRoomMembers(
  memberships: Array<{
    player_id?: string | null;
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
): Array<Omit<RoomMemberSummary, "tone">> {
  return memberships.map((membership) => {
    const player = Array.isArray(membership.players) ? membership.players[0] : membership.players;
    const name = normalizeDisplayName(player?.display_name ?? "Player");
    const role: "admin" | "member" = membership.role === "admin" ? "admin" : "member";

    return {
      name,
      initials: normalizeDisplayName(player?.avatar_initials ?? "GB"),
      playerId: membership.player_id ?? undefined,
      role,
      status: role === "admin" ? "Admin" : "Joined"
    };
  });
}

function dedupeRoomMembers(
  members: Array<Omit<RoomMemberSummary, "tone">>
): Array<Omit<RoomMemberSummary, "tone">> {
  const membersByName = new Map<string, Omit<RoomMemberSummary, "tone">>();

  for (const nextMember of members) {
    const nameKey = playerNameKey(nextMember.name);
    const currentMember = membersByName.get(nameKey);

    if (!currentMember) {
      membersByName.set(nameKey, nextMember);
      continue;
    }

    if (nextMember.status === "Admin" && currentMember.status !== "Admin") {
      membersByName.set(nameKey, { ...currentMember, playerId: nextMember.playerId, role: "admin", status: "Admin" });
    }
  }

  return Array.from(membersByName.values());
}

function withMemberTones(members: Array<Omit<RoomMemberSummary, "tone">>): RoomMemberSummary[] {
  return members.map((member, index) => ({
    ...member,
    tone: index === 0 ? "gold" : index === 2 ? "blue" : index === 3 ? "red" : "green"
  }));
}

export async function getCurrentPlayerRoomShortcuts(): Promise<PlayerRoomShortcut[]> {
  const matches = await getUpcomingMatches();
  const activeMatchIds = getActiveMatchIds(matches);
  const openMatchIds = getOpenPredictionMatchIds(matches);
  const nextMatch = getRoomShortcutMatch(matches, activeMatchIds, openMatchIds);

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

function getRoomShortcutMatch(matches: AppMatch[], activeMatchIds: Set<string>, openMatchIds: Set<string>): AppMatch | undefined {
  return (
    matches.find((match) => activeMatchIds.has(match.id) || activeMatchIds.has(match.apiMatchId)) ??
    matches.find((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId)) ??
    matches[0]
  );
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
