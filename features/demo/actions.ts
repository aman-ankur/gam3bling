"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withSupabaseRetry } from "@/lib/supabase/retry";
import { hashSecret, setPlayerSession } from "@/features/players/session";

type IdRow = {
  id: string;
};

const DEMO_PLAYERS = [
  {
    displayName: "Amanwa Demo",
    initials: "AD",
    color: "#e8c56a",
    finalHomeScore: 2,
    finalAwayScore: 1,
    halftimeHomeScore: 1,
    halftimeAwayScore: 0,
    first: "home",
    last: "away"
  },
  {
    displayName: "Kamesh Demo",
    initials: "KD",
    color: "#26c66b",
    finalHomeScore: 3,
    finalAwayScore: 1,
    halftimeHomeScore: 0,
    halftimeAwayScore: 0,
    first: "home",
    last: "home"
  },
  {
    displayName: "Rohan Demo",
    initials: "RD",
    color: "#1a7cff",
    finalHomeScore: 1,
    finalAwayScore: 2,
    halftimeHomeScore: 0,
    halftimeAwayScore: 1,
    first: "away",
    last: "away"
  },
  {
    displayName: "Maya Demo",
    initials: "MD",
    color: "#e7505f",
    finalHomeScore: 2,
    finalAwayScore: 0,
    halftimeHomeScore: 1,
    halftimeAwayScore: 0,
    first: "home",
    last: "home"
  }
] as const;

export async function createDemoRoom(): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    redirect("/?demoError=config");
  }

  const suffix = randomBytes(3).toString("hex");
  const slug = `demo-room-${suffix}`;
  const inviteCode = `DEMO${suffix.slice(0, 2).toUpperCase()}`;
  const tournamentId = await getTournamentId(supabase);
  const teams = await getDemoTeams(supabase);
  const homeTeamId = teams.home.id;
  const awayTeamId = teams.away.id;
  const kickoffAt = new Date(Date.now() - 125 * 60 * 1000).toISOString();

  const { data: players, error: playerError } = await withSupabaseRetry<IdRow[]>(() =>
    supabase
      .from("players")
      .insert(DEMO_PLAYERS.map((player) => ({
        display_name: player.displayName,
        pin_hash: hashSecret(`demo:${slug}:${player.displayName}`),
        avatar_color: player.color,
        avatar_badge: "demo",
        avatar_initials: player.initials
      })))
      .select("id")
  , { label: "demo.players.insert" });

  if (playerError || !players?.length) {
    throw new Error(playerError?.message ?? "Could not create demo players");
  }

  const creatorPlayerId = players[0].id;
  const { data: room, error: roomError } = await withSupabaseRetry<{ id: string; slug: string }>(() =>
    supabase
      .from("rooms")
      .insert({
        name: "Demo Results Room",
        slug,
        invite_code: inviteCode,
        invite_code_hash: hashSecret(inviteCode),
        creator_player_id: creatorPlayerId
      })
      .select("id, slug")
      .single()
  , { label: "demo.rooms.insert" });

  if (roomError || !room) {
    throw new Error(roomError?.message ?? "Could not create demo room");
  }

  const { data: match, error: matchError } = await withSupabaseRetry<{ id: string; api_match_id: string }>(() =>
    supabase
      .from("matches")
      .insert({
        id: randomUUID(),
        tournament_id: tournamentId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffAt,
        stage: "Demo Final",
        group_name: "Demo",
        status: "live",
        api_provider: "demo",
        api_match_id: `demo-${slug}`
      })
      .select("id, api_match_id")
      .single()
  , { label: "demo.matches.insert" });

  if (matchError || !match) {
    throw new Error(matchError?.message ?? "Could not create demo match");
  }

  const { error: memberError } = await withSupabaseRetry<null>(() =>
    supabase.from("room_members").insert(players.map((player, index) => ({
      room_id: room.id,
      player_id: player.id,
      role: index === 0 ? "admin" : "member"
    })))
  , { label: "demo.room_members.insert" });

  if (memberError) {
    throw new Error(memberError.message);
  }

  const { error: predictionError } = await withSupabaseRetry<null>(() =>
    supabase.from("predictions").insert(players.map((player, index) => {
      const demoPlayer = DEMO_PLAYERS[index];

      return {
        match_id: match.id,
        player_id: player.id,
        final_home_score: demoPlayer.finalHomeScore,
        final_away_score: demoPlayer.finalAwayScore,
        match_result: demoPlayer.finalHomeScore > demoPlayer.finalAwayScore ? "home" : demoPlayer.finalAwayScore > demoPlayer.finalHomeScore ? "away" : "draw",
        halftime_home_score: demoPlayer.halftimeHomeScore,
        halftime_away_score: demoPlayer.halftimeAwayScore,
        first_scoring_team_id: demoPlayer.first === "home" ? homeTeamId : awayTeamId,
        last_scoring_team_id: demoPlayer.last === "home" ? homeTeamId : awayTeamId,
        locked_at: kickoffAt
      };
    }))
  , { label: "demo.predictions.insert" });

  if (predictionError) {
    throw new Error(predictionError.message);
  }

  await setPlayerSession({ playerId: creatorPlayerId, roomId: room.id, roomSlug: room.slug });
  redirect(`/r/${room.slug}/matches/${match.api_match_id}?saved=1`);
}

async function getTournamentId(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<string> {
  const { data, error } = await withSupabaseRetry<IdRow>(() =>
    supabase
      .from("tournaments")
      .select("id")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()
  , { label: "demo.tournaments.select" });

  if (error || !data) {
    throw new Error(error?.message ?? "Could not find tournament for demo");
  }

  return data.id;
}

async function getDemoTeams(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<{ home: IdRow; away: IdRow }> {
  const { data, error } = await withSupabaseRetry<Array<IdRow & { short_code: string }>>(() =>
    supabase
      .from("teams")
      .select("id, short_code")
      .in("short_code", ["NED", "JPN"])
  , { label: "demo.teams.select" });

  if (error || !data) {
    throw new Error(error?.message ?? "Could not find demo teams");
  }

  const home = data.find((team) => team.short_code === "NED");
  const away = data.find((team) => team.short_code === "JPN");

  if (!home || !away) {
    throw new Error("Demo teams NED and JPN are required");
  }

  return { home, away };
}
