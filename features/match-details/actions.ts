"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMatchByRouteId } from "@/features/matches/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { createApiFootballProvider } from "@/features/sync/api-football-provider";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ensureMatchDetailsForMatches } from "./cache";
import { createSupabaseMatchDetailsStore } from "./data";

type RoomAdminRow = {
  id: string;
  creator_player_id: string | null;
  slug: string;
};

export async function refreshMatchDetails(roomSlug: string, matchRouteId: string): Promise<void> {
  const targetPath = `/r/${roomSlug}/matches/${matchRouteId}`;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    redirect(`${targetPath}?details=error`);
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
    redirect(`${targetPath}?details=missing`);
  }

  if (!session || session.roomId !== room.id || session.playerId !== room.creator_player_id) {
    redirect(`${targetPath}?details=permission`);
  }

  const result = await ensureMatchDetailsForMatches({
    force: true,
    matches: [match],
    provider: createApiFootballProvider(),
    store: createSupabaseMatchDetailsStore(supabase)
  });
  const detailStatus =
    result.failed > 0 ? "error" :
      result.skippedInvalidApiId > 0 ? "invalid" :
        "checked";

  revalidatePath(targetPath);
  redirect(`${targetPath}?details=${detailStatus}`);
}
