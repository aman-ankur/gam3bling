import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CountdownTimer } from "@/components/countdown-timer";
import { InlineRefreshButton } from "@/components/inline-refresh-button";
import { LiveMatchClock } from "@/components/live-match-clock";
import { LineupPitch } from "@/components/lineup-pitch";
import { MatchDetailTabs } from "@/components/match-detail-tabs";
import { MatchResultBreakdown, ResultCheckPanel } from "@/components/match-result-breakdown";
import { MatchStatsPanel } from "@/components/match-stats-panel";
import { PredictionForm } from "@/components/prediction-form";
import { PredictionReceipt } from "@/components/prediction-receipt";
import { RoomMissing } from "@/components/room-missing";
import { RoomPicksBoard } from "@/components/room-picks-board";
import { TeamComparisonPanel } from "@/components/team-comparison-panel";
import { MatchupName, TeamName } from "@/components/team-name";
import { savePrediction } from "@/features/predictions/actions";
import { getMatchByRouteId, getUpcomingMatches } from "@/features/matches/data";
import type { AppMatch } from "@/features/matches/data";
import { isMatchInOpenPredictionWindow } from "@/features/matches/prediction-window";
import { refreshMatchDetailsInline } from "@/features/match-details/actions";
import { getCachedMatchDetails } from "@/features/match-details/data";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { isPredictionLocked } from "@/features/predictions/locking";
import { getRoomMatchPicks } from "@/features/predictions/data";
import { checkMatchResultInline, refreshMatchScoreInline } from "@/features/results/actions";
import { getResultCheckState } from "@/features/results/check-window";
import { getRoomSummary } from "@/features/rooms/data";
import { getCurrentDate } from "@/features/time/now";
import { formatKickoffInIst, formatRefreshTimeInIst } from "@/features/time/match-time";
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
    score?: string;
  }>;
};

export default async function MatchPredictionPage({ params, searchParams }: MatchPredictionPageProps) {
  const { matchId, slug } = await params;
  const { details, error, result, saved, score } = await searchParams;
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
  const initialNow = now.toISOString();
  const kickoffLocked = isPredictionLocked({ now, kickoffAt: new Date(match.kickoffAt), status: match.status });
  const windowLocked = !isMatchInOpenPredictionWindow(match, matches, now);
  const locked = kickoffLocked || windowLocked;
  const predictionAction = savePrediction.bind(null, slug, match.apiMatchId);
  const resultCheckAction = checkMatchResultInline.bind(null, slug, match.apiMatchId);
  const refreshScoreAction = refreshMatchScoreInline.bind(null, slug, match.apiMatchId);
  const refreshDetailsAction = refreshMatchDetailsInline.bind(null, slug, match.apiMatchId);
  const resultCheckState = getResultCheckState(
    {
      kickoffAt: match.kickoffAt,
      lastSyncedAt: match.lastSyncedAt,
      status: match.status
    },
    now
  );
  const supabase = getSupabaseAdmin();
  const [matchDetails, roomPicks, session] = await Promise.all([
    getCachedMatchDetails(supabase, match),
    getRoomMatchPicks(slug, match),
    getPlayerSessionForRoom(slug)
  ]);
  const currentPrediction = roomPicks.find((pick) => pick.isCurrentPlayer && pick.saved);
  const receiptPrediction = currentPrediction ?? (saved ? createFallbackReceipt(match) : undefined);
  const isFinalMatch = match.status === "final" && match.homeScore != null && match.awayScore != null;
  const canShowOfficialScore = ["live", "halftime", "final"].includes(match.status)
    && match.homeScore != null
    && match.awayScore != null;
  const scoreRefreshLabel = match.lastSyncedAt
    ? formatRefreshTimeInIst(match.lastSyncedAt)
    : canShowOfficialScore ? "Synced from provider" : "No provider score yet";
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
      {result === "checked" && !isFinalMatch ? <p className="success-banner">Final result checked and room scores refreshed.</p> : null}
      {scoreMessage(score) ? <p className="locked-banner">{scoreMessage(score)}</p> : null}
      {detailsMessage(details) ? <p className={details === "checked" ? "success-banner" : "locked-banner"}>{detailsMessage(details)}</p> : null}

      {isFinalMatch ? (
        <div className="post-result-stack">
          {receiptPrediction ? (
            <MatchResultBreakdown match={match} pick={receiptPrediction} />
          ) : (
            <FinalMatchSummary match={match} />
          )}
          <TeamComparisonPanel match={match} matches={matches} mode="static" />
          <RoomPicksBoard awayTeam={match.awayTeam} eyebrow="Friends" homeTeam={match.homeTeam} picks={roomPicks} showResults title="Room predictions" />
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
          <section className="match-ticket match-card sport-card match-hero-score-card" aria-labelledby="match-title">
            <div className="ticket-meta match-hero-meta">
              <div>
                <span>{match.stage}</span>
                <small>{formatKickoffInIst(match.kickoffAt)}</small>
              </div>
              <strong>
                {match.status === "live" || match.status === "halftime" ? "Live now" : <CountdownTimer kickoffAt={match.kickoffAt} />}
              </strong>
            </div>
            <h1 aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`} className="sr-only" id="match-title">
              <MatchupName awayTeam={match.awayTeam} homeTeam={match.homeTeam} />
            </h1>
            <div className="sport-matchup" aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`}>
              <div className="sport-team">
                <TeamName team={match.homeTeam} />
              </div>
              <div className="center-lock">
                <b className={canShowOfficialScore ? "score-value" : "versus-value"}>
                  {canShowOfficialScore ? `${match.homeScore}-${match.awayScore}` : "vs"}
                </b>
                <small>
                  {match.status === "live" || match.status === "halftime" ? (
                    <LiveMatchClock initialNow={initialNow} kickoffAt={match.kickoffAt} status={match.status} />
                  ) : canShowOfficialScore ? (
                    "Latest"
                  ) : (
                    "No score"
                  )}
                </small>
              </div>
              <div className="sport-team">
                <TeamName team={match.awayTeam} />
              </div>
            </div>
            <div className="match-action-row match-score-sync-row">
              <div>
                <small>{scoreRefreshLabel}</small>
              </div>
              <div className="match-score-refresh">
                <InlineRefreshButton action={refreshScoreAction} className="secondary-button subtle-refresh-button" pendingLabel="Refreshing...">
                  Refresh
                </InlineRefreshButton>
              </div>
            </div>
          </section>

          <MatchDetailTabs
            compare={<TeamComparisonPanel match={match} matches={matches} mode="static" />}
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

function FinalMatchSummary({ match }: { match: AppMatch }) {
  return (
    <section className="post-result-hero" aria-labelledby="post-result-title">
      <p className="eyebrow">{match.groupName ? `${match.groupName} · Final` : `${match.stage} · Final`}</p>
      <h2 id="post-result-title">
        <span>{match.homeTeam.name} {match.homeScore}-{match.awayScore}</span>
        <span>{match.awayTeam.name}</span>
      </h2>
      <p>Room predictions are settled below, including points and market hits for every saved pick.</p>
    </section>
  );
}

function MatchDetailsRefreshPanel({ action, status }: { action: () => Promise<{ ok: boolean; message: string; status: string }>; status?: string }) {
  return (
    <div className="match-details-refresh">
      <p>{status === "checked" ? "Latest provider check completed." : "Lineups usually arrive 20-40 minutes before kickoff."}</p>
      <InlineRefreshButton action={action} className="secondary-button" pendingLabel="Checking provider...">
        Fetch latest lineups & stats
      </InlineRefreshButton>
    </div>
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

function scoreMessage(score: string | undefined): string | undefined {
  if (score === "pending") {
    return "Score checked. No provider update yet.";
  }

  if (score === "error") {
    return "The score refresh failed. Try again in a few minutes.";
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
