import { AppShell } from "@/components/app-shell";
import { LineupPitch } from "@/components/lineup-pitch";
import { MatchDetailTabs } from "@/components/match-detail-tabs";
import { MatchStatsPanel } from "@/components/match-stats-panel";
import { PredictionForm } from "@/components/prediction-form";
import { PredictionReceipt } from "@/components/prediction-receipt";
import { RoomMissing } from "@/components/room-missing";
import { RoomPicksBoard } from "@/components/room-picks-board";
import { MatchupName } from "@/components/team-name";
import { savePrediction } from "@/features/predictions/actions";
import { getMatchByRouteId, getUpcomingMatches } from "@/features/matches/data";
import type { AppMatch } from "@/features/matches/data";
import { isMatchInOpenPredictionWindow } from "@/features/matches/prediction-window";
import { ensureMatchDetailsForMatches } from "@/features/match-details/cache";
import { createSupabaseMatchDetailsStore, getCachedMatchDetails } from "@/features/match-details/data";
import { isPredictionLocked } from "@/features/predictions/locking";
import { getRoomMatchPicks } from "@/features/predictions/data";
import { getRoomSummary } from "@/features/rooms/data";
import { createApiFootballProvider } from "@/features/sync/api-football-provider";
import { getCurrentDate } from "@/features/time/now";
import { formatKickoffInIst } from "@/features/time/match-time";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type MatchPredictionPageProps = {
  params: Promise<{
    slug: string;
    matchId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function MatchPredictionPage({ params, searchParams }: MatchPredictionPageProps) {
  const { matchId, slug } = await params;
  const { error, saved } = await searchParams;
  const matches = await getUpcomingMatches();
  const room = await getRoomSummary(slug);

  if (!room.exists) {
    return <RoomMissing slug={slug} />;
  }

  const match = matches.find((candidate) => candidate.id === matchId || candidate.apiMatchId === matchId) ?? await getMatchByRouteId(matchId);

  if (!match) {
    console.warn("[matches.prediction] missing", { slug, matchId });

    return (
      <AppShell roomName={room.name} roomSlug={slug} subtitle="Make predictions">
        <section className="hero-card match-hero">
          <p className="eyebrow">Missing fixture</p>
          <h1>Match not found</h1>
          <p>This fixture is not available yet.</p>
        </section>
      </AppShell>
    );
  }

  const now = getCurrentDate();
  const kickoffLocked = isPredictionLocked({ now, kickoffAt: new Date(match.kickoffAt) });
  const windowLocked = !isMatchInOpenPredictionWindow(match, matches, now);
  const locked = kickoffLocked || windowLocked;
  const action = savePrediction.bind(null, slug, match.apiMatchId);
  const supabase = getSupabaseAdmin();

  if (supabase && !windowLocked && !process.env.E2E_USE_FALLBACK_FIXTURES) {
    await ensureMatchDetailsForMatches({
      matches: [match],
      provider: createApiFootballProvider(),
      store: createSupabaseMatchDetailsStore(supabase)
    });
  }

  const matchDetails = await getCachedMatchDetails(supabase, match);
  const roomPicks = await getRoomMatchPicks(slug, match);
  const currentPrediction = roomPicks.find((pick) => pick.isCurrentPlayer && pick.saved);
  const receiptPrediction = currentPrediction ?? (saved ? createFallbackReceipt(match) : undefined);

  console.info("[matches.prediction] loaded", {
    slug,
    matchId: match.apiMatchId,
    locked,
    kickoffLocked,
    windowLocked
  });

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle={receiptPrediction ? "Prediction saved" : "Make predictions"}>
      <section className="hero-card match-hero" aria-labelledby="match-title">
        <p className="eyebrow">{match.stage}</p>
        <h1 aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`} id="match-title">
          <MatchupName awayTeam={match.awayTeam} homeTeam={match.homeTeam} />
        </h1>
        <p>{formatKickoffInIst(match.kickoffAt)}. {windowLocked && !kickoffLocked ? "Only the next 4 matches are open for predictions." : "Kickoff locks this match."}</p>
      </section>

      {error === "invalid" ? <p className="locked-banner">That prediction combination did not make sense. Adjust the score and try again.</p> : null}
      {error === "locked" ? <p className="locked-banner">This match is locked for predictions.</p> : null}

      <MatchDetailTabs
        predictions={(
          <>
            {receiptPrediction ? (
              <PredictionReceipt
                awayTeam={match.awayTeam}
                finalScore={receiptPrediction.finalScore ?? `${receiptPrediction.finalHomeScore ?? 2}-${receiptPrediction.finalAwayScore ?? 1}`}
                firstScoringTeamId={receiptPrediction.firstScoringTeamId}
                halftimeScore={receiptPrediction.halftimeScore}
                homeTeam={match.homeTeam}
                lastScoringTeamId={receiptPrediction.lastScoringTeamId}
                result={receiptPrediction.matchResult}
              />
            ) : null}

            {receiptPrediction ? <RoomPicksBoard awayTeam={match.awayTeam} homeTeam={match.homeTeam} picks={roomPicks} /> : null}

            <details className="edit-prediction-panel" open={!receiptPrediction}>
              <summary>
                <span>{receiptPrediction ? "Edit prediction" : "Make prediction"}</span>
                <b>{receiptPrediction ? "Expand" : "Open"}</b>
              </summary>
              <PredictionForm
                action={action}
                awayTeam={match.awayTeam}
                homeTeam={match.homeTeam}
                initialPrediction={receiptPrediction}
                locked={locked}
              />
            </details>
          </>
        )}
        lineups={<LineupPitch lineups={matchDetails.lineups} teams={[match.homeTeam, match.awayTeam]} />}
        stats={<MatchStatsPanel match={match} statistics={matchDetails.statistics} />}
      />
    </AppShell>
  );
}

function createFallbackReceipt(match: AppMatch) {
  return {
    playerId: "local-player",
    playerName: "You",
    playerInitials: "Y",
    finalHomeScore: 2,
    finalAwayScore: 1,
    finalScore: "2-1",
    halftimeHomeScore: 1,
    halftimeAwayScore: 0,
    halftimeScore: "1-0",
    matchResult: "home" as const,
    firstScoringTeamId: match.homeTeam.id,
    lastScoringTeamId: match.awayTeam.id,
    result: match.homeTeam.name,
    scorers: `${match.homeTeam.name} first, ${match.awayTeam.name} last`,
    points: 0,
    saved: true,
    isCurrentPlayer: true
  };
}
