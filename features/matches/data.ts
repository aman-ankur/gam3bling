import { getSupabaseAdmin } from "@/lib/supabase/server";
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

    const mappedMatches = matchRows.flatMap<AppMatch>((match) => {
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
          awayScore: match.away_score
        }];
      });

    return prioritizeUpcoming(mappedMatches);
  } catch {
    return fallbackAppMatches();
  }
}

export async function getMatchByRouteId(routeId: string): Promise<AppMatch | null> {
  const matches = await getUpcomingMatches();

  return matches.find((match) => match.id === routeId || match.apiMatchId === routeId) ?? null;
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
