import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LineupPitch } from "@/components/lineup-pitch";
import { MatchDetailTabs } from "@/components/match-detail-tabs";
import { MatchResultBreakdown, ResultCheckPanel } from "@/components/match-result-breakdown";
import { MatchStatsPanel } from "@/components/match-stats-panel";
import { PredictionForm } from "@/components/prediction-form";
import { PredictionReceipt } from "@/components/prediction-receipt";
import { RoomMissing } from "@/components/room-missing";
import { RoomPicksBoard } from "@/components/room-picks-board";
import { SubmitButton } from "@/components/submit-button";
import { MatchupName } from "@/components/team-name";
import { savePrediction } from "@/features/predictions/actions";
import { getMatchByRouteId, getUpcomingMatches } from "@/features/matches/data";
import type { AppMatch } from "@/features/matches/data";
import { isMatchInOpenPredictionWindow } from "@/features/matches/prediction-window";
import { refreshMatchDetails } from "@/features/match-details/actions";
import { ensureMatchDetailsForMatches } from "@/features/match-details/cache";
import { createSupabaseMatchDetailsStore, getCachedMatchDetails } from "@/features/match-details/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { isPredictionLocked } from "@/features/predictions/locking";
import { getRoomMatchPicks } from "@/features/predictions/data";
import { checkMatchResult } from "@/features/results/actions";
import { getResultCheckState } from "@/features/results/check-window";
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
    details?: string;
    error?: string;
    result?: string;
    saved?: string;
  }>;
};

export default async function MatchPredictionPage({ params, searchParams }: MatchPredictionPageProps) {
  const { matchId, slug } = await params;
  const { details, error, result, saved } = await searchParams;
  const matches = await getUpcomingMatches({ includeDemo: isDemoRoomSlug(slug) });
  const room = await getRoomSummary(slug);

  if (!room.exists) {
    return <RoomMissing slug={slug} />;
  }

  const match = matches.find((candidate) => candidate.id === matchId || candidate.apiMatchId === matchId) ?? await getMatchByRouteId(matchId);

  if (!match) {
    console.warn("[matches.prediction] missing", { slug, matchId });

    return (
      <AppShell roomName={room.name} roomSlug={slug} subtitle="Make predictions">
        <Link className="match-back-link" href={`/r/${slug}?hub=1`}>
          Back to room
        </Link>
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
  const predictionAction = savePrediction.bind(null, slug, match.apiMatchId);
  const resultCheckAction = checkMatchResult.bind(null, slug, match.apiMatchId);
  const refreshDetailsAction = refreshMatchDetails.bind(null, slug, match.apiMatchId);
  const resultCheckState = getResultCheckState(
    {
      kickoffAt: match.kickoffAt,
      lastSyncedAt: match.lastSyncedAt,
      status: match.status
    },
    now
  );
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
  const session = await getPlayerSessionForRoom(slug);
  const currentPrediction = roomPicks.find((pick) => pick.isCurrentPlayer && pick.saved);
  const receiptPrediction = currentPrediction ?? (saved ? createFallbackReceipt(match) : undefined);
  const isSettledPrediction = Boolean(receiptPrediction && match.status === "final");
  const isRoomCreator = Boolean(session && room.creatorPlayerId && session.playerId === room.creatorPlayerId);
  const refreshDetailsPanel = isRoomCreator ? (
    <MatchDetailsRefreshPanel action={refreshDetailsAction} status={details} />
  ) : null;

  console.info("[matches.prediction] loaded", {
    slug,
    matchId: match.apiMatchId,
    locked,
    kickoffLocked,
    windowLocked
  });

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle={receiptPrediction ? "Prediction saved" : "Make predictions"}>
      <Link className="match-back-link" href={`/r/${slug}?hub=1`}>
        Back to room
      </Link>

      {error === "invalid" ? <p className="locked-banner">That prediction combination did not make sense. Adjust the score and try again.</p> : null}
      {error === "locked" ? <p className="locked-banner">This match is locked for predictions.</p> : null}
      {result === "checked" && !isSettledPrediction ? <p className="success-banner">Final result checked and room scores refreshed.</p> : null}
      {detailsMessage(details) ? <p className={details === "checked" ? "success-banner" : "locked-banner"}>{detailsMessage(details)}</p> : null}

      {isSettledPrediction && receiptPrediction ? (
        <div className="post-result-stack">
          <MatchResultBreakdown match={match} pick={receiptPrediction} />
          <RoomPicksBoard awayTeam={match.awayTeam} eyebrow="Friends" homeTeam={match.homeTeam} picks={roomPicks} title="Room predictions" />
          <details className="edit-prediction-panel">
            <summary>
              <span>Edit prediction</span>
              <b>Expand</b>
            </summary>
            <PredictionForm
              action={predictionAction}
              awayTeam={match.awayTeam}
              homeTeam={match.homeTeam}
              initialPrediction={receiptPrediction}
              locked={locked}
            />
          </details>
        </div>
      ) : (
        <>
          <section className="hero-card match-hero" aria-labelledby="match-title">
            <p className="eyebrow">{match.stage}</p>
            <h1 aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`} id="match-title">
              <MatchupName awayTeam={match.awayTeam} homeTeam={match.homeTeam} />
            </h1>
            <p>{formatKickoffInIst(match.kickoffAt)}. {windowLocked && !kickoffLocked ? "Only the next 4 matches are open for predictions." : "Kickoff locks this match."}</p>
          </section>

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

                {locked && match.status !== "final" ? (
                  <ResultCheckPanel action={resultCheckAction} resultMessage={resultMessage(result)} state={resultCheckState} />
                ) : null}

                <details className="edit-prediction-panel" open={!receiptPrediction}>
                  <summary>
                    <span>{receiptPrediction ? "Edit prediction" : "Make prediction"}</span>
                    <b>{receiptPrediction ? "Expand" : "Open"}</b>
                  </summary>
                  <PredictionForm
                    action={predictionAction}
                    awayTeam={match.awayTeam}
                    homeTeam={match.homeTeam}
                    initialPrediction={receiptPrediction}
                    locked={locked}
                  />
                </details>
              </>
            )}
            lineups={<LineupPitch emptyAction={refreshDetailsPanel} lineups={matchDetails.lineups} teams={[match.homeTeam, match.awayTeam]} />}
            stats={<MatchStatsPanel emptyAction={refreshDetailsPanel} match={match} statistics={matchDetails.statistics} />}
          />
        </>
      )}
    </AppShell>
  );
}

function MatchDetailsRefreshPanel({ action, status }: { action: (formData: FormData) => Promise<void>; status?: string }) {
  return (
    <form action={action} className="match-details-refresh">
      <p>{status === "checked" ? "Latest provider check completed." : "Lineups usually arrive 20-40 minutes before kickoff."}</p>
      <SubmitButton className="secondary-button" pendingLabel="Checking provider...">
        Fetch latest lineups & stats
      </SubmitButton>
    </form>
  );
}

function detailsMessage(details: string | undefined): string | undefined {
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

  if (details === "error") {
    return "The provider details check failed. Try again in a few minutes.";
  }

  if (details === "access") {
    return "API-Football account access is blocked. Check the API key/account before fetching lineups or stats.";
  }

  return undefined;
}

function resultMessage(result: string | undefined): string | undefined {
  if (result === "pending") {
    return "Official final result is not available yet. Try again after the cooldown.";
  }

  if (result === "cooldown") {
    return "This match was checked recently. Try again after the 5-minute cooldown.";
  }

  if (result === "early") {
    return "Result checks open around 115 minutes after kickoff.";
  }

  if (result === "error") {
    return "The provider check failed. Try again in a few minutes.";
  }

  if (result === "checked") {
    return "Final result checked and room scores refreshed.";
  }

  return undefined;
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
    scoreFinal: 0,
    scoreResult: 0,
    scoreHalftime: 0,
    scoreFirstScorer: 0,
    scoreLastScorer: 0,
    points: 0,
    saved: true,
    isCurrentPlayer: true
  };
}

function isDemoRoomSlug(slug: string): boolean {
  return slug.startsWith("demo-room-");
}
