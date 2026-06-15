import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withSupabaseRetry } from "@/lib/supabase/retry";
import { matches as fallbackMatches, teamById, teams as fallbackTeams } from "@/features/fixtures/world-cup-2026";
import { getCurrentDate } from "../time/now";

export type AppTeam = {
  id: string;
  name: string;
  shortCode: string;
  flagCode?: string | null;
};

export type AppMatch = {
  id: string;
  apiMatchId: string;
  homeTeam: AppTeam;
  awayTeam: AppTeam;
  kickoffAt: string;
  stage: string;
  groupName?: string | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHalftimeScore?: number | null;
  awayHalftimeScore?: number | null;
  firstScoringTeamId?: string | null;
  lastScoringTeamId?: string | null;
  lastSyncedAt?: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  short_code: string;
  flag_code?: string | null;
};

type MatchRow = {
  id: string;
  api_match_id?: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  stage: string;
  group_name?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
  home_halftime_score?: number | null;
  away_halftime_score?: number | null;
  first_scoring_team_id?: string | null;
  last_scoring_team_id?: string | null;
  last_synced_at?: string | null;
};

export async function getUpcomingMatches(): Promise<AppMatch[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return fallbackAppMatches();
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return fallbackAppMatches();
  }

  try {
    const [{ data: matchRows, error: matchError }, { data: teamRows, error: teamError }] = await Promise.all([
      supabase.from("matches").select("*").order("kickoff_at", { ascending: true }).limit(40),
      supabase.from("teams").select("*")
    ]);

    if (matchError || teamError || !matchRows || !teamRows) {
      return fallbackAppMatches();
    }

    const mappedMatches = mapMatchRows(matchRows as MatchRow[], teamRows as TeamRow[]);

    return prioritizeUpcoming(mappedMatches);
  } catch {
    return fallbackAppMatches();
  }
}

export async function getMatchByRouteId(routeId: string): Promise<AppMatch | null> {
  const matches = await getUpcomingMatches();
  const listedMatch = matches.find((match) => match.id === routeId || match.apiMatchId === routeId);

  if (listedMatch) {
    return listedMatch;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase || process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return null;
  }

  try {
    const byApiMatch = await withSupabaseRetry<MatchRow>(() =>
      supabase
        .from("matches")
        .select("*")
        .eq("api_match_id", routeId)
        .maybeSingle()
    , { label: "matches.route.select_by_api_match_id" });

    if (byApiMatch.error) {
      console.warn("[matches.route] api_match_lookup_failed", { routeId, message: byApiMatch.error.message });
      return null;
    }

    let matchRow = byApiMatch.data as MatchRow | null;

    if (!matchRow && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeId)) {
      const byId = await withSupabaseRetry<MatchRow>(() =>
        supabase
          .from("matches")
          .select("*")
          .eq("id", routeId)
          .maybeSingle()
      , { label: "matches.route.select_by_id" });

      if (byId.error) {
        console.warn("[matches.route] id_lookup_failed", { routeId, message: byId.error.message });
        return null;
      }

      matchRow = byId.data as MatchRow | null;
    }

    if (!matchRow) {
      return null;
    }

    const { data: teamRows, error: teamError } = await withSupabaseRetry<TeamRow[]>(() =>
      supabase.from("teams").select("*")
    , { label: "matches.route.teams.select" });

    if (teamError || !teamRows) {
      console.warn("[matches.route] teams_lookup_failed", { routeId, message: teamError?.message ?? "No teams returned" });
      return null;
    }

    return mapMatchRows([matchRow], teamRows as TeamRow[])[0] ?? null;
  } catch (error) {
    console.warn("[matches.route] lookup_failed", {
      routeId,
      message: error instanceof Error ? error.message : "Unknown match lookup error"
    });
    return null;
  }
}

function mapMatchRows(matchRows: MatchRow[], teamRows: TeamRow[]): AppMatch[] {
  const teamsById = new Map<string, AppTeam>(
    teamRows.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        shortCode: team.short_code,
        flagCode: team.flag_code
      }
    ])
  );

  return matchRows.flatMap<AppMatch>((match) => {
    const homeTeam = teamsById.get(match.home_team_id);
    const awayTeam = teamsById.get(match.away_team_id);

    if (!homeTeam || !awayTeam) {
      return [];
    }

    return [{
      id: match.id,
      apiMatchId: match.api_match_id ?? match.id,
      homeTeam,
      awayTeam,
      kickoffAt: match.kickoff_at,
      stage: match.stage,
      groupName: match.group_name,
      status: match.status,
      homeScore: match.home_score,
      awayScore: match.away_score,
      homeHalftimeScore: match.home_halftime_score,
      awayHalftimeScore: match.away_halftime_score,
      firstScoringTeamId: match.first_scoring_team_id,
      lastScoringTeamId: match.last_scoring_team_id,
      lastSyncedAt: match.last_synced_at
    }];
  });
}

function fallbackAppMatches(): AppMatch[] {
  return prioritizeUpcoming(fallbackMatches.map((match) => {
    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);

    if (!homeTeam || !awayTeam) {
      throw new Error(`Missing fallback team for ${match.apiMatchId}`);
    }

    return {
      id: match.id,
      apiMatchId: match.apiMatchId,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        shortCode: homeTeam.shortCode,
        flagCode: homeTeam.flagCode
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        shortCode: awayTeam.shortCode,
        flagCode: awayTeam.flagCode
      },
      kickoffAt: match.kickoffAt,
      stage: match.stage,
      groupName: match.groupName,
      status: match.status
    };
  }));
}

export function fallbackTeamOptions(): AppTeam[] {
  return fallbackTeams.map((team) => ({
    id: team.id,
    name: team.name,
    shortCode: team.shortCode,
    flagCode: team.flagCode
  }));
}

function prioritizeUpcoming(matches: AppMatch[]): AppMatch[] {
  const now = getCurrentDate().getTime();

  return [...matches].sort((a, b) => {
    const aTime = new Date(a.kickoffAt).getTime();
    const bTime = new Date(b.kickoffAt).getTime();
    const aLocked = aTime <= now;
    const bLocked = bTime <= now;

    if (aLocked !== bLocked) {
      return aLocked ? 1 : -1;
    }

    return aTime - bTime;
  });
}
