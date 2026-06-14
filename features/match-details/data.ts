import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppMatch } from "@/features/matches/data";
import type {
  MatchDetailCacheRecord,
  MatchDetailCacheStatus,
  MatchDetailsCacheStore,
  MatchDetailsSavePayload,
  MatchDetailsView,
  MatchLineupPlayerView,
  MatchLineupView,
  MatchTeamStatisticView
} from "./types";

type MatchDetailRow = {
  status: MatchDetailCacheStatus;
  lineups_status: MatchDetailCacheStatus;
  stats_status: MatchDetailCacheStatus;
  last_fetched_at: string | null;
};

type MatchLineupRow = {
  id: string;
  team_id: string;
  formation: string | null;
  coach_name: string | null;
  teams?: {
    name?: string | null;
  } | Array<{
    name?: string | null;
  }> | null;
};

type MatchLineupPlayerRow = {
  match_lineup_id: string;
  player_name: string;
  shirt_number: number | null;
  position: string | null;
  grid: string | null;
  role: "starter" | "substitute";
  sort_order: number;
};

type MatchTeamStatisticRow = {
  team_id: string;
  stat_name: string;
  stat_value: string | null;
  sort_order: number;
  teams?: {
    name?: string | null;
  } | Array<{
    name?: string | null;
  }> | null;
};

export function createSupabaseMatchDetailsStore(supabase: SupabaseClient): MatchDetailsCacheStore {
  return {
    async getCache(matchId: string): Promise<MatchDetailCacheRecord | null> {
      const { data } = await supabase
        .from("match_details")
        .select("status, lineups_status, stats_status, last_fetched_at")
        .eq("match_id", matchId)
        .maybeSingle();

      if (!data) {
        return null;
      }

      const row = data as MatchDetailRow;

      return {
        status: row.status,
        lineupsStatus: row.lineups_status,
        statsStatus: row.stats_status,
        lastFetchedAt: row.last_fetched_at
      };
    },
    async saveDetails(payload: MatchDetailsSavePayload): Promise<void> {
      await saveMatchDetails(supabase, payload);
    },
    async recordFailure({ errorMessage, fetchedAt, matchId, provider }): Promise<void> {
      await supabase
        .from("match_details")
        .upsert({
          match_id: matchId,
          provider,
          status: "failed",
          lineups_status: "failed",
          stats_status: "failed",
          last_fetched_at: fetchedAt,
          last_error: errorMessage,
          updated_at: fetchedAt
        }, { onConflict: "match_id" });
    }
  };
}

export async function getCachedMatchDetails(supabase: SupabaseClient | null, match: AppMatch): Promise<MatchDetailsView> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackMatchDetails(match);
  }

  if (!supabase) {
    return emptyMatchDetails();
  }

  const { data: detailRow } = await supabase
    .from("match_details")
    .select("lineups_status, stats_status")
    .eq("match_id", match.id)
    .maybeSingle();
  const detail = detailRow as { lineups_status?: MatchDetailCacheStatus; stats_status?: MatchDetailCacheStatus } | null;

  if (!detail) {
    return emptyMatchDetails();
  }

  const { data: lineupRows } = await supabase
    .from("match_lineups")
    .select("id, team_id, formation, coach_name, teams(name)")
    .eq("match_id", match.id)
    .order("team_id", { ascending: true });
  const lineups = (lineupRows ?? []) as MatchLineupRow[];
  const lineupIds = lineups.map((lineup) => lineup.id);
  const { data: playerRows } = lineupIds.length > 0
    ? await supabase
      .from("match_lineup_players")
      .select("match_lineup_id, player_name, shirt_number, position, grid, role, sort_order")
      .in("match_lineup_id", lineupIds)
      .order("sort_order", { ascending: true })
    : { data: [] };
  const { data: statRows } = await supabase
    .from("match_team_statistics")
    .select("team_id, stat_name, stat_value, sort_order, teams(name)")
    .eq("match_id", match.id)
    .order("sort_order", { ascending: true });
  const playersByLineup = new Map<string, MatchLineupPlayerView[]>();

  for (const row of (playerRows ?? []) as MatchLineupPlayerRow[]) {
    const players = playersByLineup.get(row.match_lineup_id) ?? [];
    players.push({
      playerName: row.player_name,
      shirtNumber: row.shirt_number,
      position: row.position,
      grid: row.grid,
      role: row.role,
      sortOrder: row.sort_order
    });
    playersByLineup.set(row.match_lineup_id, players);
  }

  return {
    lineupsStatus: detail.lineups_status ?? "missing",
    statsStatus: detail.stats_status ?? "missing",
    lineups: lineups.map((lineup) => ({
      id: lineup.id,
      teamId: lineup.team_id,
      teamName: teamNameFromJoin(lineup.teams) ?? teamNameFromMatch(lineup.team_id, match),
      formation: lineup.formation,
      coachName: lineup.coach_name,
      players: playersByLineup.get(lineup.id) ?? []
    })),
    statistics: ((statRows ?? []) as MatchTeamStatisticRow[]).map((row) => ({
      teamId: row.team_id,
      teamName: teamNameFromJoin(row.teams) ?? teamNameFromMatch(row.team_id, match),
      statName: row.stat_name,
      statValue: row.stat_value,
      sortOrder: row.sort_order
    }))
  };
}

async function saveMatchDetails(supabase: SupabaseClient, payload: MatchDetailsSavePayload): Promise<void> {
  const status = payload.details.lineupsStatus === "available" || payload.details.statisticsStatus === "available"
    ? "available"
    : "unavailable";

  await supabase
    .from("match_details")
    .upsert({
      match_id: payload.matchId,
      provider: payload.provider,
      status,
      lineups_status: payload.details.lineupsStatus,
      stats_status: payload.details.statisticsStatus,
      last_fetched_at: payload.fetchedAt,
      last_success_at: status === "available" ? payload.fetchedAt : null,
      last_error: null,
      raw_payload: payload.details.rawPayload,
      updated_at: payload.fetchedAt
    }, { onConflict: "match_id" });

  await supabase.from("match_lineups").delete().eq("match_id", payload.matchId);
  await supabase.from("match_team_statistics").delete().eq("match_id", payload.matchId);

  const teamIdByProviderId = mapProviderTeamIds(payload);

  for (const lineup of payload.details.lineups) {
    const teamId = teamIdByProviderId.get(lineup.providerTeamId);

    if (!teamId) {
      continue;
    }

    const { data: insertedLineup } = await supabase
      .from("match_lineups")
      .insert({
        match_id: payload.matchId,
        team_id: teamId,
        provider_team_id: lineup.providerTeamId,
        formation: lineup.formation,
        coach_name: lineup.coachName,
        source_updated_at: payload.fetchedAt
      })
      .select("id")
      .single();
    const lineupId = (insertedLineup as { id?: string } | null)?.id;

    if (!lineupId || lineup.players.length === 0) {
      continue;
    }

    await supabase.from("match_lineup_players").insert(lineup.players.map((player) => ({
      match_lineup_id: lineupId,
      provider_player_id: player.providerPlayerId,
      player_name: player.playerName,
      shirt_number: player.shirtNumber,
      position: player.position,
      grid: player.grid,
      role: player.role,
      sort_order: player.sortOrder
    })));
  }

  const statistics = payload.details.statistics.flatMap((stat) => {
    const teamId = teamIdByProviderId.get(stat.providerTeamId);

    if (!teamId) {
      return [];
    }

    return [{
      match_id: payload.matchId,
      team_id: teamId,
      stat_name: stat.statName,
      stat_value: stat.statValue,
      sort_order: stat.sortOrder
    }];
  });

  if (statistics.length > 0) {
    await supabase.from("match_team_statistics").insert(statistics);
  }
}

function mapProviderTeamIds(payload: MatchDetailsSavePayload): Map<string, string> {
  const mapped = new Map<string, string>();

  for (const lineup of payload.details.lineups) {
    const localTeamId = localTeamIdFromName(lineup.teamName, payload);

    if (localTeamId) {
      mapped.set(lineup.providerTeamId, localTeamId);
    }
  }

  for (const stat of payload.details.statistics) {
    const localTeamId = localTeamIdFromName(stat.teamName, payload);

    if (localTeamId) {
      mapped.set(stat.providerTeamId, localTeamId);
    }
  }

  return mapped;
}

function localTeamIdFromName(teamName: string, payload: MatchDetailsSavePayload): string | null {
  const normalized = normalizeName(teamName);

  if (normalized === normalizeName(payload.homeTeamName)) {
    return payload.homeTeamId;
  }

  if (normalized === normalizeName(payload.awayTeamName)) {
    return payload.awayTeamId;
  }

  return null;
}

function emptyMatchDetails(): MatchDetailsView {
  return {
    lineupsStatus: "missing",
    statsStatus: "missing",
    lineups: [],
    statistics: []
  };
}

function fallbackMatchDetails(match: AppMatch): MatchDetailsView {
  const homeLineup: MatchLineupView = {
    id: "fallback-home-lineup",
    teamId: match.homeTeam.id,
    teamName: match.homeTeam.name,
    formation: "4-2-3-1",
    coachName: null,
    players: [
      player("Bart Verbruggen", 1, "G", "1:1", 0),
      player("Denzel Dumfries", 22, "D", "2:1", 1),
      player("Virgil van Dijk", 4, "D", "2:2", 2),
      player("Nathan Ake", 5, "D", "2:3", 3),
      player("Daley Blind", 17, "D", "2:4", 4),
      player("Tijjani Reijnders", 14, "M", "3:1", 5),
      player("Frenkie de Jong", 21, "M", "3:2", 6),
      player("Cody Gakpo", 11, "F", "4:1", 7),
      player("Xavi Simons", 10, "M", "4:2", 8),
      player("Jeremie Frimpong", 7, "F", "4:3", 9),
      player("Memphis Depay", 9, "F", "5:1", 10)
    ]
  };

  return {
    lineupsStatus: "available",
    statsStatus: "available",
    lineups: [homeLineup],
    statistics: [
      statistic(match.homeTeam.id, match.homeTeam.name, "Ball Possession", "58%", 0),
      statistic(match.awayTeam.id, match.awayTeam.name, "Ball Possession", "42%", 0),
      statistic(match.homeTeam.id, match.homeTeam.name, "Total Shots", "13", 1),
      statistic(match.awayTeam.id, match.awayTeam.name, "Total Shots", "6", 1),
      statistic(match.homeTeam.id, match.homeTeam.name, "Corner Kicks", "5", 2),
      statistic(match.awayTeam.id, match.awayTeam.name, "Corner Kicks", "3", 2)
    ]
  };
}

function player(
  playerName: string,
  shirtNumber: number,
  position: string,
  grid: string,
  sortOrder: number
): MatchLineupPlayerView {
  return {
    playerName,
    shirtNumber,
    position,
    grid,
    role: "starter",
    sortOrder
  };
}

function statistic(
  teamId: string,
  teamName: string,
  statName: string,
  statValue: string,
  sortOrder: number
): MatchTeamStatisticView {
  return {
    teamId,
    teamName,
    statName,
    statValue,
    sortOrder
  };
}

function teamNameFromJoin(value: MatchLineupRow["teams"] | MatchTeamStatisticRow["teams"]): string | null {
  const team = Array.isArray(value) ? value[0] : value;

  return team?.name ?? null;
}

function teamNameFromMatch(teamId: string, match: AppMatch): string {
  if (teamId === match.homeTeam.id) {
    return match.homeTeam.name;
  }

  if (teamId === match.awayTeam.id) {
    return match.awayTeam.name;
  }

  return "Team";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
