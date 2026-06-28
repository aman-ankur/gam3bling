import type { AppMatch } from "@/features/matches/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getCurrentDate } from "@/features/time/now";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RoomMatchPick = {
  playerId: string;
  playerName: string;
  playerInitials: string;
  finalHomeScore?: number;
  finalAwayScore?: number;
  finalScore?: string;
  halftimeHomeScore?: number;
  halftimeAwayScore?: number;
  halftimeScore?: string;
  penaltyHomeScore?: number;
  penaltyAwayScore?: number;
  penaltyScore?: string;
  matchResult?: "home" | "away" | "draw";
  firstScoringTeamId?: string;
  lastScoringTeamId?: string;
  result?: string;
  scorers?: string;
  scoreFinal: number;
  scoreResult: number;
  scoreHalftime: number;
  scoreFirstScorer: number;
  scoreLastScorer: number;
  scorePenalty: number;
  points: number;
  scoredAt?: string;
  saved: boolean;
  isCurrentPlayer: boolean;
};

export type CurrentPlayerMatchPickSummary = {
  finalScore: string;
  halftimeScore: string;
  penaltyScore?: string;
  result: string;
  scorers: string;
};

type InternalRoomMatchPick = RoomMatchPick & {
  joinedAt: string;
  nameKey: string;
  submittedAt?: string;
};

type RoomHistoryMatchRow = {
  id: string;
  api_provider?: string | null;
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

type RoomHistoryTeamRow = {
  id: string;
  name: string;
  short_code: string;
  flag_code?: string | null;
};

type RoomHistoryPredictionRow = {
  match_id: string;
};

type RoomPickMemberRow = {
  player_id: string;
  joined_at: string;
  players:
    | {
        display_name: string | null;
        avatar_initials: string | null;
      }
    | Array<{
        display_name: string | null;
        avatar_initials: string | null;
      }>
    | null;
};

type RoomPickPredictionRow = {
  player_id: string;
  match_id: string;
  final_home_score?: number | null;
  final_away_score?: number | null;
  halftime_home_score?: number | null;
  halftime_away_score?: number | null;
  match_result: "home" | "away" | "draw";
  first_scoring_team_id?: string | null;
  last_scoring_team_id?: string | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
  score_final?: number | null;
  score_result?: number | null;
  score_halftime?: number | null;
  score_first_scorer?: number | null;
  score_last_scorer?: number | null;
  score_penalty?: number | null;
  score_total?: number | null;
  scored_at?: string | null;
  submitted_at?: string | null;
};

type GetRoomHistoryMatchesOptions = {
  includeDemo?: boolean;
  limit?: number;
};

export async function getRoomHistoryMatches(
  roomSlug: string,
  options: GetRoomHistoryMatchesOptions = {}
): Promise<AppMatch[]> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return [];
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id").eq("slug", roomSlug).single();

    if (!room) {
      return [];
    }

    const { data: members } = await supabase
      .from("room_members")
      .select("player_id, joined_at, players(display_name, avatar_initials)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (!members?.length) {
      return [];
    }

    const playerIds = members.map((member) => member.player_id);
    const { data: predictions, error: predictionError } = await supabase
      .from("predictions")
      .select("match_id")
      .in("player_id", playerIds);

    if (predictionError || !predictions?.length) {
      return [];
    }

    const matchIds = Array.from(new Set((predictions as RoomHistoryPredictionRow[]).map((prediction) => prediction.match_id)));

    if (matchIds.length === 0) {
      return [];
    }

    const [{ data: matchRows, error: matchError }, { data: teamRows, error: teamError }] = await Promise.all([
      supabase.from("matches").select("*").in("id", matchIds),
      supabase.from("teams").select("*")
    ]);

    if (matchError || teamError || !matchRows || !teamRows) {
      return [];
    }

    const now = getCurrentDate().getTime();

    return mapRoomHistoryMatches(matchRows as RoomHistoryMatchRow[], teamRows as RoomHistoryTeamRow[])
      .filter((match) => options.includeDemo || match.apiProvider !== "demo")
      .filter((match) => isRoomHistoryMatch(match, now))
      .sort((left, right) => new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime())
      .slice(0, options.limit ?? 20);
  } catch {
    return [];
  }
}

export async function getRoomMatchPicks(roomSlug: string, match: AppMatch): Promise<RoomMatchPick[]> {
  return (await getRoomMatchPicksForMatches(roomSlug, [match])).get(match.id) ?? [];
}

export async function getRoomMatchPicksForMatches(roomSlug: string, matches: AppMatch[]): Promise<Map<string, RoomMatchPick[]>> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return new Map(matches.flatMap((match) => [
      [match.id, fallbackPicks(match)] as const,
      [match.apiMatchId, fallbackPicks(match)] as const
    ]));
  }

  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

  if (!supabase || matches.length === 0) {
    return new Map();
  }

  try {
    const { data: room } = await supabase.from("rooms").select("id").eq("slug", roomSlug).single();

    if (!room) {
      return new Map();
    }

    const { data: members } = await supabase
      .from("room_members")
      .select("player_id, joined_at, players(display_name, avatar_initials)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    if (!members?.length) {
      return new Map();
    }

    const typedMembers = members as RoomPickMemberRow[];
    const playerIds = typedMembers.map((member) => member.player_id);
    const matchIds = matches.map((nextMatch) => nextMatch.id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .in("match_id", matchIds)
      .in("player_id", playerIds);
    const predictionsByMatchId = groupPredictionsByMatchId((predictions ?? []) as RoomPickPredictionRow[]);
    const picksByMatchId = new Map<string, RoomMatchPick[]>();

    for (const nextMatch of matches) {
      const picks = buildRoomMatchPicks({
        match: nextMatch,
        members: typedMembers,
        predictions: predictionsByMatchId.get(nextMatch.id) ?? [],
        sessionPlayerId: session?.playerId
      });

      picksByMatchId.set(nextMatch.id, picks);
      picksByMatchId.set(nextMatch.apiMatchId, picks);
    }

    return picksByMatchId;
  } catch {
    return new Map();
  }
}

function groupPredictionsByMatchId(predictions: RoomPickPredictionRow[]): Map<string, RoomPickPredictionRow[]> {
  const predictionsByMatchId = new Map<string, RoomPickPredictionRow[]>();

  for (const prediction of predictions) {
    const matchPredictions = predictionsByMatchId.get(prediction.match_id) ?? [];
    matchPredictions.push(prediction);
    predictionsByMatchId.set(prediction.match_id, matchPredictions);
  }

  return predictionsByMatchId;
}

function buildRoomMatchPicks({
  match,
  members,
  predictions,
  sessionPlayerId
}: {
  match: AppMatch;
  members: RoomPickMemberRow[];
  predictions: RoomPickPredictionRow[];
  sessionPlayerId?: string;
}): RoomMatchPick[] {
  const predictionsByPlayer = new Map(predictions.map((prediction) => [prediction.player_id, prediction]));
  const picks = members.map((member): InternalRoomMatchPick => {
    const player = Array.isArray(member.players) ? member.players[0] : member.players;
    const prediction = predictionsByPlayer.get(member.player_id);
    const playerName = normalizeDisplayName(player?.display_name ?? "Player");

    return {
      playerId: member.player_id,
      playerName,
      playerInitials: player?.avatar_initials ?? "GB",
      finalHomeScore: prediction?.final_home_score ?? undefined,
      finalAwayScore: prediction?.final_away_score ?? undefined,
      finalScore: prediction ? `${prediction.final_home_score}-${prediction.final_away_score}` : undefined,
      halftimeHomeScore: prediction?.halftime_home_score ?? undefined,
      halftimeAwayScore: prediction?.halftime_away_score ?? undefined,
      halftimeScore: prediction ? `${prediction.halftime_home_score}-${prediction.halftime_away_score}` : undefined,
      penaltyHomeScore: prediction?.penalty_home_score ?? undefined,
      penaltyAwayScore: prediction?.penalty_away_score ?? undefined,
      penaltyScore: prediction?.penalty_home_score != null && prediction?.penalty_away_score != null
        ? `${prediction.penalty_home_score}-${prediction.penalty_away_score}`
        : undefined,
      matchResult: prediction?.match_result,
      firstScoringTeamId: prediction?.first_scoring_team_id ?? undefined,
      lastScoringTeamId: prediction?.last_scoring_team_id ?? undefined,
      result: prediction ? resultLabel(prediction.match_result, match) : undefined,
      scorers: prediction ? scorersLabel(prediction.first_scoring_team_id ?? null, prediction.last_scoring_team_id ?? null, match) : undefined,
      scoreFinal: prediction?.score_final ?? 0,
      scoreResult: prediction?.score_result ?? 0,
      scoreHalftime: prediction?.score_halftime ?? 0,
      scoreFirstScorer: prediction?.score_first_scorer ?? 0,
      scoreLastScorer: prediction?.score_last_scorer ?? 0,
      scorePenalty: prediction?.score_penalty ?? 0,
      points: prediction?.score_total ?? 0,
      scoredAt: prediction?.scored_at ?? undefined,
      saved: Boolean(prediction),
      isCurrentPlayer: sessionPlayerId === member.player_id,
      joinedAt: member.joined_at,
      nameKey: playerNameKey(playerName),
      submittedAt: prediction?.submitted_at ?? undefined
    };
  });

  return dedupePicksByPlayerName(picks);
}

function mapRoomHistoryMatches(matchRows: RoomHistoryMatchRow[], teamRows: RoomHistoryTeamRow[]): AppMatch[] {
  const teamsById = new Map(
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

  return matchRows.flatMap((match) => {
    const homeTeam = teamsById.get(match.home_team_id);
    const awayTeam = teamsById.get(match.away_team_id);

    if (!homeTeam || !awayTeam) {
      return [];
    }

    return [{
      id: match.id,
      apiProvider: match.api_provider,
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

function isRoomHistoryMatch(match: AppMatch, now: number): boolean {
  return ["live", "halftime", "final"].includes(match.status) || new Date(match.kickoffAt).getTime() <= now;
}

function dedupePicksByPlayerName(picks: InternalRoomMatchPick[]): RoomMatchPick[] {
  const groups = new Map<string, InternalRoomMatchPick[]>();

  for (const pick of picks) {
    const group = groups.get(pick.nameKey) ?? [];
    group.push(pick);
    groups.set(pick.nameKey, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const preferredPick = choosePreferredPick(group);

      return {
        joinedAt: preferredPick.joinedAt,
        pick: toPublicPick(preferredPick, group.some((candidate) => candidate.isCurrentPlayer))
      };
    })
    .sort((left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())
    .map(({ pick }) => pick);
}

function choosePreferredPick(group: InternalRoomMatchPick[]): InternalRoomMatchPick {
  const savedPicks = group.filter((pick) => pick.saved);

  if (savedPicks.length > 0) {
    return savedPicks.sort((left, right) => submittedAtMs(right.submittedAt) - submittedAtMs(left.submittedAt))[0];
  }

  return group.find((pick) => pick.isCurrentPlayer) ?? group[0];
}

function submittedAtMs(submittedAt: string | undefined): number {
  return submittedAt ? new Date(submittedAt).getTime() : 0;
}

function toPublicPick(pick: InternalRoomMatchPick, isCurrentPlayer: boolean): RoomMatchPick {
  return {
    playerId: pick.playerId,
    playerName: pick.playerName,
    playerInitials: pick.playerInitials,
    finalHomeScore: pick.finalHomeScore,
    finalAwayScore: pick.finalAwayScore,
    finalScore: pick.finalScore,
    halftimeHomeScore: pick.halftimeHomeScore,
    halftimeAwayScore: pick.halftimeAwayScore,
    halftimeScore: pick.halftimeScore,
    penaltyHomeScore: pick.penaltyHomeScore,
    penaltyAwayScore: pick.penaltyAwayScore,
    penaltyScore: pick.penaltyScore,
    matchResult: pick.matchResult,
    firstScoringTeamId: pick.firstScoringTeamId,
    lastScoringTeamId: pick.lastScoringTeamId,
    result: pick.result,
    scorers: pick.scorers,
    scoreFinal: pick.scoreFinal,
    scoreResult: pick.scoreResult,
    scoreHalftime: pick.scoreHalftime,
    scoreFirstScorer: pick.scoreFirstScorer,
    scoreLastScorer: pick.scoreLastScorer,
    scorePenalty: pick.scorePenalty,
    points: pick.points,
    scoredAt: pick.scoredAt,
    saved: pick.saved,
    isCurrentPlayer
  };
}

function playerNameKey(displayName: string): string {
  return normalizeDisplayName(displayName).toLocaleLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

export async function getCurrentPlayerPredictedMatchIds(roomSlug: string, matches: AppMatch[]): Promise<Set<string>> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    return new Set(["1489376", "30000000-0000-4000-8000-000000000002"]);
  }

  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

  if (!supabase || !session || matches.length === 0) {
    return new Set();
  }

  try {
    const { data: membership } = await supabase
      .from("room_members")
      .select("player_id")
      .eq("room_id", session.roomId)
      .eq("player_id", session.playerId)
      .maybeSingle();

    if (!membership) {
      return new Set();
    }

    const matchIds = matches.map((match) => match.id);
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("player_id", session.playerId)
      .in("match_id", matchIds);

    return new Set((predictions ?? []).flatMap((prediction) => {
      const match = matches.find((candidate) => candidate.id === prediction.match_id);

      return match ? [match.id, match.apiMatchId] : [prediction.match_id];
    }));
  } catch {
    return new Set();
  }
}

export async function getCurrentPlayerMatchPickSummaries(
  roomSlug: string,
  matches: AppMatch[]
): Promise<Map<string, CurrentPlayerMatchPickSummary>> {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1") {
    const fallbackMatch = matches.find((candidate) => candidate.apiMatchId === "1489376");

    return fallbackMatch
      ? new Map([
        [fallbackMatch.id, {
          finalScore: "2-1",
          halftimeScore: "1-0",
          result: fallbackMatch.homeTeam.name,
          scorers: `${fallbackMatch.homeTeam.name} first, ${fallbackMatch.awayTeam.name} last`
        }],
        [fallbackMatch.apiMatchId, {
          finalScore: "2-1",
          halftimeScore: "1-0",
          result: fallbackMatch.homeTeam.name,
          scorers: `${fallbackMatch.homeTeam.name} first, ${fallbackMatch.awayTeam.name} last`
        }]
      ])
      : new Map();
  }

  const supabase = getSupabaseAdmin();
  const session = await getPlayerSessionForRoom(roomSlug);

  if (!supabase || !session || matches.length === 0) {
    return new Map();
  }

  try {
    const { data: membership } = await supabase
      .from("room_members")
      .select("player_id")
      .eq("room_id", session.roomId)
      .eq("player_id", session.playerId)
      .maybeSingle();

    if (!membership) {
      return new Map();
    }

    const matchById = new Map(matches.map((candidate) => [candidate.id, candidate]));
    const { data: predictions } = await supabase
      .from("predictions")
      .select("match_id, final_home_score, final_away_score, halftime_home_score, halftime_away_score, penalty_home_score, penalty_away_score, match_result, first_scoring_team_id, last_scoring_team_id")
      .eq("player_id", session.playerId)
      .in("match_id", [...matchById.keys()]);
    const summaries = new Map<string, CurrentPlayerMatchPickSummary>();

    for (const prediction of predictions ?? []) {
      const predictedMatch = matchById.get(prediction.match_id);

      if (!predictedMatch) {
        continue;
      }

      const summary = {
        finalScore: `${prediction.final_home_score}-${prediction.final_away_score}`,
        halftimeScore: `${prediction.halftime_home_score}-${prediction.halftime_away_score}`,
        penaltyScore: prediction.penalty_home_score != null && prediction.penalty_away_score != null
          ? `${prediction.penalty_home_score}-${prediction.penalty_away_score}`
          : undefined,
        result: resultLabel(prediction.match_result, predictedMatch),
        scorers: scorersLabel(prediction.first_scoring_team_id, prediction.last_scoring_team_id, predictedMatch)
      };

      summaries.set(predictedMatch.id, summary);
      summaries.set(predictedMatch.apiMatchId, summary);
    }

    return summaries;
  } catch {
    return new Map();
  }
}

function fallbackPicks(match: AppMatch): RoomMatchPick[] {
  return [
    {
      playerId: "fallback-john",
      playerName: "John Doe",
      playerInitials: "JD",
      finalHomeScore: 2,
      finalAwayScore: 1,
      finalScore: "2-1",
      halftimeHomeScore: 1,
      halftimeAwayScore: 0,
      halftimeScore: "1-0",
      matchResult: "home",
      firstScoringTeamId: match.homeTeam.id,
      lastScoringTeamId: match.awayTeam.id,
      result: match.homeTeam.name,
      scorers: `${match.homeTeam.name} first, ${match.awayTeam.name} last`,
      scoreFinal: 0,
      scoreResult: 0,
      scoreHalftime: 0,
      scoreFirstScorer: 0,
      scoreLastScorer: 0,
      scorePenalty: 0,
      points: 0,
      saved: true,
      isCurrentPlayer: false
    },
    {
      playerId: "fallback-jane",
      playerName: "Jane Doe",
      playerInitials: "JD",
      scoreFinal: 0,
      scoreResult: 0,
      scoreHalftime: 0,
      scoreFirstScorer: 0,
      scoreLastScorer: 0,
      scorePenalty: 0,
      points: 0,
      saved: false,
      isCurrentPlayer: true
    }
  ];
}

function resultLabel(result: string, match: AppMatch): string {
  if (result === "home") {
    return match.homeTeam.name;
  }

  if (result === "away") {
    return match.awayTeam.name;
  }

  return "Draw";
}

function scorersLabel(firstScoringTeamId: string | null, lastScoringTeamId: string | null, match: AppMatch): string {
  if (!firstScoringTeamId || !lastScoringTeamId) {
    return "No goals";
  }

  return `${teamName(firstScoringTeamId, match)} first, ${teamName(lastScoringTeamId, match)} last`;
}

function teamName(teamId: string, match: AppMatch): string {
  if (teamId === match.homeTeam.id) {
    return match.homeTeam.name;
  }

  if (teamId === match.awayTeam.id) {
    return match.awayTeam.name;
  }

  return "Unknown";
}
