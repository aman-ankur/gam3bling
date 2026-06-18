"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMatchByRouteId } from "@/features/matches/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { createDefaultFootballProvider } from "@/features/sync/default-provider";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ensureMatchDetailsForMatches } from "./cache";
import { createSupabaseMatchDetailsStore } from "./data";

type RoomAdminRow = {
  id: string;
  creator_player_id: string | null;
  slug: string;
};

type MatchDetailsRefreshStatus = "checked" | "permission" | "invalid" | "missing" | "error" | "access";

type InlineActionResult = {
  ok: boolean;
  message: string;
  status: string;
};

export async function refreshMatchDetails(roomSlug: string, matchRouteId: string): Promise<void> {
  const targetPath = `/r/${roomSlug}/matches/${matchRouteId}`;
  const detailStatus = await refreshMatchDetailsStatus(roomSlug, matchRouteId);

  redirect(`${targetPath}?details=${detailStatus}`);
}

export async function refreshMatchDetailsInline(roomSlug: string, matchRouteId: string): Promise<InlineActionResult> {
  const detailStatus = await refreshMatchDetailsStatus(roomSlug, matchRouteId);

  return {
    ok: detailStatus === "checked",
    status: detailStatus,
    message: detailsMessage(detailStatus)
  };
}

async function refreshMatchDetailsStatus(roomSlug: string, matchRouteId: string): Promise<MatchDetailsRefreshStatus> {
  const targetPath = `/r/${roomSlug}/matches/${matchRouteId}`;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return "error";
  }

  const [match, roomResult, session] = await Promise.all([
    getMatchByRouteId(matchRouteId),
    supabase
      .from("rooms")
      .select("id, slug, creator_player_id")
      .eq("slug", roomSlug)
      .single(),
    getPlayerSessionForRoom(roomSlug)
  ]);
  const room = roomResult.data as RoomAdminRow | null;

  if (!match || !room) {
    return "missing";
  }

  if (!session || session.roomId !== room.id || session.playerId !== room.creator_player_id) {
    return "permission";
  }

  const result = await ensureMatchDetailsForMatches({
    force: true,
    matches: [match],
    provider: createDefaultFootballProvider(),
    store: createSupabaseMatchDetailsStore(supabase)
  });
  const detailStatus =
    result.failed > 0 && hasProviderAccessFailure(result.failureMessages) ? "access" :
      result.failed > 0 ? "error" :
      result.skippedInvalidApiId > 0 ? "invalid" :
        "checked";

  revalidatePath(targetPath);
  return detailStatus;
}

function detailsMessage(details: MatchDetailsRefreshStatus): string {
  if (details === "checked") {
    return "Latest lineups and stats checked.";
  }

  if (details === "permission") {
    return "Only the room creator can refresh match details.";
  }

  if (details === "invalid") {
    return "This fixture cannot fetch provider details yet.";
  }

  if (details === "missing") {
    return "This fixture could not be found.";
  }

  if (details === "access") {
    return "API-Football account access is blocked. Check the API key/account before fetching lineups or stats.";
  }

  return "The provider details check failed. Try again in a few minutes.";
}

function hasProviderAccessFailure(messages: string[]): boolean {
  return messages.some((message) => {
    const normalized = message.toLowerCase();

    return normalized.includes("access") || normalized.includes("suspended") || normalized.includes("api_football_key");
  });
}
