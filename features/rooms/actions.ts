"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withSupabaseRetry } from "@/lib/supabase/retry";
import { initialsFromName, normalizeDisplayName } from "@/features/players/identity";
import { hashSecret, setPlayerSession } from "@/features/players/session";
import { isValidInviteCode, normalizeInviteCode } from "@/features/rooms/codes";

type IdRow = {
  id: string;
};

type RoomInviteRow = {
  id: string;
  slug: string;
  invite_code_hash: string;
};

export async function createRoom(formData: FormData): Promise<void> {
  const supabase = requireSupabase();
  const roomName = stringField(formData, "roomName", "World Cup Room");
  const displayName = normalizeDisplayName(stringField(formData, "displayName", "Player"));
  const inviteCode = createInviteCode();
  const slug = `${slugify(roomName)}-${randomBytes(2).toString("hex")}`;

  console.info("[rooms.create] start", { roomName, slug });

  const { data: player, error: playerError } = await withSupabaseRetry<IdRow>(() =>
    supabase
      .from("players")
      .insert({
        display_name: displayName,
        pin_hash: hashSecret(createInternalPlayerSecret()),
        avatar_color: "#26c66b",
        avatar_badge: "cup",
        avatar_initials: initialsFromName(displayName) || "GB"
      })
      .select("id")
      .single()
  , { label: "rooms.create.players.insert" }
  );

  if (playerError || !player) {
    console.error("[rooms.create] player_failed", { slug, message: playerError?.message ?? "No player returned" });
    throw new Error(playerError?.message ?? "Could not create player");
  }

  const { data: room, error: roomError } = await withSupabaseRetry<IdRow>(() =>
    supabase
      .from("rooms")
      .insert({
        name: roomName,
        slug,
        invite_code_hash: hashSecret(normalizeInviteCode(inviteCode)),
        creator_player_id: player.id
      })
      .select("id")
      .single()
  , { label: "rooms.create.rooms.insert" }
  );

  if (roomError || !room) {
    console.error("[rooms.create] room_failed", { slug, playerId: player.id, message: roomError?.message ?? "No room returned" });
    throw new Error(roomError?.message ?? "Could not create room");
  }

  const { error: memberError } = await withSupabaseRetry<null>(() =>
    supabase.from("room_members").insert({
      room_id: room.id,
      player_id: player.id,
      role: "admin"
    })
  , { label: "rooms.create.room_members.insert" }
  );

  if (memberError) {
    console.error("[rooms.create] member_failed", { slug, roomId: room.id, playerId: player.id, message: memberError.message });
    throw new Error(memberError.message);
  }

  console.info("[rooms.create] success", { slug, roomId: room.id, playerId: player.id });
  await setPlayerSession({ playerId: player.id, roomId: room.id, roomSlug: slug });
  redirect(`/r/${slug}?invite=${inviteCode}`);
}

export async function joinRoom(slug: string, formData: FormData): Promise<void> {
  const supabase = requireSupabase();
  const inviteCode = normalizeInviteCode(stringField(formData, "inviteCode", ""));
  const displayName = normalizeDisplayName(stringField(formData, "displayName", "Player"));

  console.info("[rooms.join] start", { slug });

  const { data: room, error: roomError } = await withSupabaseRetry<RoomInviteRow>(() =>
    supabase.from("rooms").select("id, slug, invite_code_hash").eq("slug", slug).single()
  , { label: "rooms.join.rooms.select" }
  );

  if (roomError || !room) {
    console.warn("[rooms.join] room_missing", { slug, message: roomError?.message ?? "No room returned" });
    redirect(`/r/${slug}?error=room`);
  }

  if (room.invite_code_hash !== hashSecret(inviteCode)) {
    console.warn("[rooms.join] invalid_invite", { slug, roomId: room.id });
    redirect(`/r/${slug}?error=code`);
  }

  await completeRoomJoin({
    displayName,
    roomId: room.id,
    roomSlug: room.slug,
    supabase,
    logLabel: "rooms.join"
  });
  redirect(`/r/${room.slug}/matches`);
}

export async function joinRoomByCode(formData: FormData): Promise<void> {
  const supabase = requireSupabase();
  const inviteCode = normalizeInviteCode(stringField(formData, "inviteCode", ""));
  const displayName = normalizeDisplayName(stringField(formData, "displayName", "Player"));
  const failureTarget = { code: "/?joinError=code" };

  console.info("[rooms.join_by_code] start");

  if (!isValidInviteCode(inviteCode)) {
    redirect(failureTarget.code);
  }

  const { data: room, error: roomError } = await withSupabaseRetry<RoomInviteRow>(() =>
    supabase.from("rooms").select("id, slug, invite_code_hash").eq("invite_code_hash", hashSecret(inviteCode)).single()
  , { label: "rooms.join_by_code.rooms.select" }
  );

  if (roomError || !room) {
    console.warn("[rooms.join_by_code] room_missing", { message: roomError?.message ?? "No room returned" });
    redirect(failureTarget.code);
  }

  await completeRoomJoin({
    displayName,
    roomId: room.id,
    roomSlug: room.slug,
    supabase,
    logLabel: "rooms.join_by_code"
  });
  redirect(`/r/${room.slug}/matches`);
}

async function completeRoomJoin({
  displayName,
  roomId,
  roomSlug,
  supabase,
  logLabel
}: {
  displayName: string;
  roomId: string;
  roomSlug: string;
  supabase: ReturnType<typeof requireSupabase>;
  logLabel: string;
}): Promise<void> {
  const { data: player, error: playerError } = await withSupabaseRetry<IdRow>(() =>
    supabase
      .from("players")
      .insert({
        display_name: displayName,
        pin_hash: hashSecret(createInternalPlayerSecret()),
        avatar_color: "#26c66b",
        avatar_badge: "cup",
        avatar_initials: initialsFromName(displayName) || "GB"
      })
      .select("id")
      .single()
  , { label: `${logLabel}.players.insert` }
  );

  if (playerError || !player) {
    console.error(`[${logLabel}] player_failed`, { roomSlug, roomId, message: playerError?.message ?? "No player returned" });
    throw new Error(playerError?.message ?? "Could not join room");
  }

  const { error: memberError } = await withSupabaseRetry<null>(() =>
    supabase.from("room_members").upsert({
      room_id: roomId,
      player_id: player.id,
      role: "member"
    })
  , { label: `${logLabel}.room_members.upsert` }
  );

  if (memberError) {
    console.error(`[${logLabel}] member_failed`, { roomSlug, roomId, playerId: player.id, message: memberError.message });
    throw new Error(memberError.message);
  }

  console.info(`[${logLabel}] success`, { roomSlug, roomId, playerId: player.id });
  await setPlayerSession({ playerId: player.id, roomId, roomSlug });
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error("Supabase environment variables are required for room actions");
  }

  return supabase;
}

function stringField(formData: FormData, key: string, fallback: string): string {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createInternalPlayerSecret(): string {
  return randomBytes(16).toString("hex");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "room"
  );
}
