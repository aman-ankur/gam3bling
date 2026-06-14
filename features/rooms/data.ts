import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUpcomingMatches } from "@/features/matches/data";
import { getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSession } from "@/features/players/session";

export type RoomSummary = {
  id: string;
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
  savedCount: number;
  score: number;
};

const fallbackRoom: RoomSummary = {
  id: "fallback-room",
  name: "Goa WC Chaos",
  slug: "goa-wc-chaos",
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
    return { ...fallbackRoom, slug, name: titleFromSlug(slug) };
  }

  try {
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("slug", slug).single();

    if (roomError || !room) {
      return { ...fallbackRoom, slug, name: titleFromSlug(slug) };
    }

    const { data: memberships, error: memberError } = await supabase
      .from("room_members")
      .select("role, players(display_name, avatar_initials, avatar_color)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (memberError || !memberships) {
      return { id: room.id, name: room.name, slug: room.slug, members: [] };
    }

    return {
      id: room.id,
      name: room.name,
      slug: room.slug,
      members: memberships.map((membership, index) => {
        const player = Array.isArray(membership.players) ? membership.players[0] : membership.players;

        return {
          name: player?.display_name ?? "Player",
          initials: player?.avatar_initials ?? "GB",
          status: membership.role === "admin" ? "Admin" : "Joined",
          tone: index === 0 ? "gold" : index === 2 ? "blue" : index === 3 ? "red" : "green"
        };
      })
    };
  } catch {
    return { ...fallbackRoom, slug, name: titleFromSlug(slug) };
  }
}

export async function getCurrentPlayerRoomShortcuts(): Promise<PlayerRoomShortcut[]> {
  const matches = await getUpcomingMatches();
  const openMatchIds = getOpenPredictionMatchIds(matches);
  const nextMatch = matches.find((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId)) ?? matches[0];

  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return [
      {
        name: "Goa WC Chaos",
        slug: "goa-wc-chaos",
        href: "/r/goa-wc-chaos",
        nextMatchLabel: nextMatch ? `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}` : "Next fixture",
        nextMatchHref: nextMatch ? `/r/goa-wc-chaos/matches/${nextMatch.apiMatchId}` : "/r/goa-wc-chaos/matches",
        savedCount: 3,
        score: 44
      }
    ];
  }

  const [session, supabase] = await Promise.all([getPlayerSession(), Promise.resolve(getSupabaseAdmin())]);

  if (!session || !supabase) {
    return [];
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id, name, slug").eq("id", session.roomId).single();

    if (!room) {
      return [];
    }

    const { data: predictions } = await supabase
      .from("predictions")
      .select("score_total")
      .eq("player_id", session.playerId);
    const savedCount = predictions?.length ?? 0;
    const score = predictions?.reduce((total, prediction) => total + (prediction.score_total ?? 0), 0) ?? 0;

    return [
      {
        name: room.name,
        slug: room.slug,
        href: `/r/${room.slug}`,
        nextMatchLabel: nextMatch ? `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}` : "Next fixture",
        nextMatchHref: nextMatch ? `/r/${room.slug}/matches/${nextMatch.apiMatchId}` : `/r/${room.slug}/matches`,
        savedCount,
        score
      }
    ];
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
