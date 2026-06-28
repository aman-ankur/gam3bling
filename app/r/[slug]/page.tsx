import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { InlineRefreshButton } from "@/components/inline-refresh-button";
import { LatestResultCard } from "@/components/latest-result-card";
import { LiveMatchClock } from "@/components/live-match-clock";
import { MatchCard } from "@/components/match-card";
import { MemberList } from "@/components/member-list";
import { RoomInviteCard } from "@/components/room-invite-card";
import { RoomMissing } from "@/components/room-missing";
import { ScoringGuide } from "@/components/scoring-guide";
import { SubmitButton } from "@/components/submit-button";
import { TeamName } from "@/components/team-name";
import { getRoomLeaderboard } from "@/features/leaderboards/data";
import { getRoomScoreRows } from "@/features/leaderboards/room-score-preview";
import { getUpcomingMatches } from "@/features/matches/data";
import type { AppMatch } from "@/features/matches/data";
import { getActiveMatchIds, getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getCurrentPlayerMatchPickSummaries, getCurrentPlayerPredictedMatchIds, getRoomHistoryMatches, getRoomMatchPicksForMatches } from "@/features/predictions/data";
import type { CurrentPlayerMatchPickSummary } from "@/features/predictions/data";
import { refreshRoomScoresInline } from "@/features/results/actions";
import { claimRoomPlayer, deleteRoom, joinRoom, rememberRoomInviteCode, removeRoomMember } from "@/features/rooms/actions";
import { getRoomSummary, type RoomSummary } from "@/features/rooms/data";
import { formatKickoffInIst, formatRefreshTimeInIst } from "@/features/time/match-time";
import { getCurrentDate } from "@/features/time/now";

type RoomPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    claimName?: string;
    claimPlayerId?: string;
    admin?: string;
    adminError?: string;
    error?: string;
    hub?: string;
    invite?: string;
    inviteError?: string;
    scores?: string;
  }>;
};

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { slug } = await params;
  const { admin, adminError, claimName, claimPlayerId, error, hub, invite, inviteError, scores } = await searchParams;
  const [room, session] = await Promise.all([
    getRoomSummary(slug),
    getPlayerSessionForRoom(slug)
  ]);
  const shouldShowHub = hub === "1" || Boolean(session);

  if (!room.exists) {
    return <RoomMissing slug={slug} />;
  }

  if (shouldShowHub) {
    const matches = await getUpcomingMatches({ includeDemo: isDemoRoomSlug(slug) });
    const [leaderboard, predictedMatchIds, historyMatches] = await Promise.all([
      getRoomLeaderboard(slug),
      getCurrentPlayerPredictedMatchIds(slug, matches),
      getRoomHistoryMatches(slug, { includeDemo: isDemoRoomSlug(slug), limit: 12 })
    ]);
    const now = getCurrentDate();
    const initialNow = now.toISOString();
    const activeMatchIds = getActiveMatchIds(matches, now);
    const openMatchIds = getOpenPredictionMatchIds(matches, now);
    const activeMatches = matches.filter((match) => hasMatchId(activeMatchIds, match));
    const openMatches = matches.filter((match) => hasMatchId(openMatchIds, match));
    const currentMatches = [...activeMatches, ...openMatches.filter((match) => !hasMatchId(activeMatchIds, match))].slice(0, 10);
    const [currentPlayerPickSummaries, historyPickSetsByMatchId] = await Promise.all([
      getCurrentPlayerMatchPickSummaries(slug, currentMatches),
      getRoomMatchPicksForMatches(slug, historyMatches)
    ]);
    const latestResultPickSets = historyMatches.map((match) => historyPickSetsByMatchId.get(match.id) ?? []);
    const featuredMatch = currentMatches[0];
    const featuredMatchIsActive = featuredMatch ? hasMatchId(activeMatchIds, featuredMatch) : false;
    const otherCurrentMatches = currentMatches.slice(1);
    const currentMatchesRefreshLabel = latestRefreshLabel(currentMatches);
    const roomScoreRows = getRoomScoreRows(leaderboard);
    const currentPlayerScore = session ? leaderboard.find((entry) => entry.playerId === session.playerId)?.score : undefined;
    const visibleInvite = room.inviteCode ?? invite ?? (room.id === "fallback-room" ? "TIGER7" : undefined);
    const shareLink = await buildShareLink(slug, visibleInvite);
    const recoverInviteAction = rememberRoomInviteCode.bind(null, slug);
    const isRoomCreator = Boolean(session && room.creatorPlayerId && session.playerId === room.creatorPlayerId);
    const refreshScoresAction = refreshRoomScoresInline.bind(null, slug);

    return (
      <AppShell roomName={room.name} roomSlug={slug} subtitle="Room hub">
        <section className="hero-card room-hub-hero" aria-labelledby="room-hub-title">
          <p className="eyebrow">Room command center</p>
          <h1 id="room-hub-title"><RoomTitleWithRound roomName={room.name} /></h1>
          <div className="hub-stats">
            <div>
              <span>Members</span>
              <b>{room.members.length}</b>
            </div>
            <div>
              <span>Your score</span>
              <b>{currentPlayerScore ?? 0}</b>
            </div>
            <div>
              <span>Leader</span>
              <b>{leaderboard[0]?.score ?? 0}</b>
            </div>
          </div>
        </section>

        <section className="section-stack" aria-labelledby="room-current-title">
          {scoreRefreshMessage(scores) ? <p className="locked-banner">{scoreRefreshMessage(scores)}</p> : null}
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current round</p>
              <h2 id="room-current-title">{featuredMatchIsActive ? "Live now" : "Predict next"}</h2>
            </div>
            <div className="section-heading-actions">
              <span className="status-chip">{activeMatches.length > 0 ? `${activeMatches.length} live` : `${openMatches.length} open`}</span>
              <InlineRefreshButton action={refreshScoresAction} className="secondary-button compact-link" pendingLabel="Refreshing...">
                Refresh scores
              </InlineRefreshButton>
              {currentMatchesRefreshLabel ? <small className="refresh-timestamp">{currentMatchesRefreshLabel}</small> : null}
            </div>
          </div>
          <div className="match-list">
            {featuredMatch ? (
              <MatchCard
                actionLabel={
                  predictedMatchIds.has(featuredMatch.id) || predictedMatchIds.has(featuredMatch.apiMatchId)
                    ? "View pick"
                    : featuredMatchIsActive
                      ? "View"
                      : "Predict"
                }
                awayTeam={featuredMatch.awayTeam}
                featured
                homeScore={featuredMatch.homeScore}
                awayScore={featuredMatch.awayScore}
                homeTeam={featuredMatch.homeTeam}
                href={`/r/${slug}/matches/${featuredMatch.apiMatchId}`}
                initialNow={initialNow}
                kickoffAt={featuredMatch.kickoffAt}
                metaLabel={featuredMatchIsActive ? "Match live" : "Predictions open"}
                pickSummary={compactPickSummary(currentPlayerPickSummaries.get(featuredMatch.id) ?? currentPlayerPickSummaries.get(featuredMatch.apiMatchId))}
                progress={
                  predictedMatchIds.has(featuredMatch.id) || predictedMatchIds.has(featuredMatch.apiMatchId)
                    ? "Saved"
                    : featuredMatchIsActive
                      ? "Locked"
                      : "Save to reveal"
                }
                stage={featuredMatch.stage}
                status={featuredMatchIsActive ? "live" : "open"}
                variant="sport"
              />
            ) : null}
          </div>

          {otherCurrentMatches.length > 0 ? (
            <div className="other-open-matches" aria-label={activeMatches.length > 0 ? "Other matches" : "Other open matches"}>
              <p className="eyebrow">{activeMatches.length > 0 ? "Other matches" : "Other open matches"}</p>
              {otherCurrentMatches.map((match) => (
                <OtherOpenMatchLink
                  isSaved={predictedMatchIds.has(match.id) || predictedMatchIds.has(match.apiMatchId)}
                  isActive={hasMatchId(activeMatchIds, match)}
                  initialNow={initialNow}
                  key={match.id}
                  match={match}
                  pickSummary={currentPlayerPickSummaries.get(match.id) ?? currentPlayerPickSummaries.get(match.apiMatchId)}
                  slug={slug}
                />
              ))}
            </div>
          ) : null}
        </section>

        <RoomAccordion eyebrow="Room score" title="Room score">
          <ol className="compact-leader-list">
            {roomScoreRows.length > 0 ? (
              roomScoreRows.map((entry) => (
                <li key={entry.playerId ?? entry.name}>
                  <span>{entry.rank}</span>
                  <strong>{entry.name}</strong>
                  <b>{entry.score} pts</b>
                </li>
              ))
            ) : (
              <li className="empty-compact-row">
                <strong>No scored predictions yet</strong>
                <b>0 pts</b>
              </li>
            )}
          </ol>
          <ScoringGuide variant="details" />
        </RoomAccordion>

        <RoomAccordion eyebrow="Results ledger" title="History">
          <div className="history-refresh-row">
            <span>Past room picks appear here even before the provider has settled them.</span>
            <InlineRefreshButton action={refreshScoresAction} className="secondary-button compact-link" pendingLabel="Refreshing...">
              Refresh scores
            </InlineRefreshButton>
          </div>
          {historyMatches.length > 0 ? (
            <div className="latest-results-list" aria-label="Room prediction history">
              {historyMatches.map((match, index) => (
                <LatestResultCard key={match.id} match={match} picks={latestResultPickSets[index] ?? []} slug={slug} />
              ))}
            </div>
          ) : (
            <div className="history-preview">
              <strong>Completed matches will appear here</strong>
              <span>Round winners, exact-score hits, and score changes will live in this section.</span>
            </div>
          )}
        </RoomAccordion>

        <RoomInviteCard
          collapsible
          inviteCode={visibleInvite}
          inviteError={inviteError}
          recoverInviteAction={room.inviteCode ? undefined : recoverInviteAction}
          shortLink={shareLink}
        />

        {isRoomCreator ? (
          <AdminRoomControls
            adminStatus={admin}
            adminError={adminError}
            deleteRoomAction={deleteRoom.bind(null, slug)}
            members={room.adminMembers ?? room.members}
            removeMemberAction={removeRoomMember.bind(null, slug)}
            roomName={room.name}
            roomCreatorPlayerId={room.creatorPlayerId}
          />
        ) : null}
      </AppShell>
    );
  }

  const joinAction = joinRoom.bind(null, slug);
  const claimAction = claimRoomPlayer.bind(null, slug);
  const visibleInvite = invite ?? (room.id === "fallback-room" ? "TIGER7" : undefined);
  const shareLink = await buildShareLink(slug, visibleInvite);
  const hasClaimPrompt = Boolean(claimPlayerId && claimName && visibleInvite);

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle="Invite friends">
      <section className="hero-card setup-hero" aria-labelledby="join-room-title">
        <div className="cup-mark">GB</div>
        <p className="eyebrow">World Cup 2026</p>
        <h1 id="join-room-title">Join {room.name}</h1>
        <p>Short link, one invite code, and your display name. No email circus.</p>
      </section>

      {error ? <p className="locked-banner">Check the room code and try again.</p> : null}
      {hasClaimPrompt ? (
        <section className="claim-card" aria-label="Existing player found">
          <div>
            <p className="eyebrow">Player already here</p>
            <h2>{claimName} is already in this room</h2>
            <p>Claim this player to keep their saved predictions, score, and room history on this browser.</p>
          </div>
          <form action={claimAction}>
            <input name="inviteCode" type="hidden" defaultValue={visibleInvite} />
            <input name="playerId" type="hidden" defaultValue={claimPlayerId} />
            <SubmitButton pendingLabel="Restoring player...">Yes, this is me</SubmitButton>
          </form>
          <Link className="secondary-button" href={`/r/${slug}${visibleInvite ? `?invite=${encodeURIComponent(visibleInvite)}` : ""}`}>
            Use another name
          </Link>
        </section>
      ) : null}

      <form action={joinAction} className="form-card" aria-label="Join room form">
        <label>
          Room code
          <input aria-label="Room code" defaultValue={visibleInvite ?? ""} name="inviteCode" />
        </label>
        <label>
          Display name
          <input aria-label="Display name" name="displayName" placeholder="John" />
        </label>
        <SubmitButton pendingLabel="Entering room...">Enter {room.name}</SubmitButton>
      </form>

      <RoomInviteCard inviteCode={visibleInvite} shortLink={shareLink} />
      <MemberList members={room.members} />

      <Link className="ghost-link" href="/new">
        Create a new room
      </Link>
    </AppShell>
  );
}

function AdminRoomControls({
  adminError,
  adminStatus,
  deleteRoomAction,
  members,
  removeMemberAction,
  roomCreatorPlayerId,
  roomName
}: {
  adminError?: string;
  adminStatus?: string;
  deleteRoomAction: (formData: FormData) => Promise<void>;
  members: RoomSummary["members"];
  removeMemberAction: (formData: FormData) => Promise<void>;
  roomCreatorPlayerId?: string;
  roomName: string;
}) {
  const removableMembers = members.filter((member) => member.playerId && member.playerId !== roomCreatorPlayerId);

  return (
    <details className="section-stack room-accordion admin-room-panel" aria-labelledby="room-admin-title">
      <summary className="room-accordion-summary">
        <div>
          <p className="eyebrow">Admin</p>
          <h2 id="room-admin-title">Manage room</h2>
        </div>
        <span className="status-chip">Creator only</span>
      </summary>

      <div className="room-accordion-body">
        {adminStatus === "playerRemoved" ? <p className="admin-feedback success">Player removed from this room.</p> : null}
        {adminError ? <p className="admin-feedback error">Could not complete that admin action.</p> : null}

        <div className="admin-member-list" aria-label="Remove room members">
          {members.map((member) => {
            const canRemove = Boolean(member.playerId && member.playerId !== roomCreatorPlayerId);

            return (
              <div className="admin-member-row" key={member.playerId ?? member.name}>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.status}</span>
                </div>
                {canRemove ? (
                  <form action={removeMemberAction}>
                    <input name="playerId" type="hidden" value={member.playerId ?? ""} />
                    <SubmitButton className="danger-button compact-danger-button" pendingLabel="Removing...">
                      Remove
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="admin-lock-label">Creator</span>
                )}
              </div>
            );
          })}
        </div>

        {removableMembers.length === 0 ? (
          <p className="section-note">No removable players yet. Invite friends first, then they will appear here.</p>
        ) : null}

        <details className="delete-room-disclosure">
          <summary>Delete this room</summary>
          <form action={deleteRoomAction}>
            <p>Deletes {roomName} and removes it from everyone&apos;s room list. Predictions stay in the database, but this room disappears.</p>
            <SubmitButton className="danger-button" pendingLabel="Deleting room...">
              Delete room
            </SubmitButton>
          </form>
        </details>
      </div>
    </details>
  );
}

function RoomAccordion({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <details className="section-stack room-accordion">
      <summary className="room-accordion-summary">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="status-chip">Expand</span>
      </summary>
      <div className="room-accordion-body">
        {children}
      </div>
    </details>
  );
}

function hasMatchId(matchIds: Set<string>, match: AppMatch): boolean {
  return matchIds.has(match.id) || matchIds.has(match.apiMatchId);
}

function OtherOpenMatchLink({
  initialNow,
  isActive,
  isSaved,
  match,
  pickSummary,
  slug
}: {
  initialNow: string;
  isActive: boolean;
  isSaved: boolean;
  match: AppMatch;
  pickSummary?: CurrentPlayerMatchPickSummary;
  slug: string;
}) {
  const matchTitle = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const actionLabel = isSaved ? "Show" : isActive ? "View" : "Predict";
  const scoreText = isActive && match.homeScore != null && match.awayScore != null ? `${match.homeScore}-${match.awayScore}` : "vs";

  return (
    <Link
      aria-label={`${isSaved ? "Show prediction" : isActive ? "View match" : "Predict"} ${matchTitle}`}
      className="other-open-match-row"
      href={`/r/${slug}/matches/${match.apiMatchId}`}
    >
      <div>
        <strong>
          <TeamName team={match.homeTeam} />
          <span>{scoreText}</span>
          <TeamName team={match.awayTeam} />
        </strong>
        <small>
          {isActive ? (
            <>
              Live <LiveMatchClock initialNow={initialNow} kickoffAt={match.kickoffAt} status="live" />
            </>
          ) : (
            formatKickoffInIst(match.kickoffAt)
          )}
        </small>
        {pickSummary ? <em>Pick: {compactPickSummary(pickSummary)}</em> : null}
      </div>
      <span>{actionLabel}</span>
    </Link>
  );
}

function compactPickSummary(summary?: CurrentPlayerMatchPickSummary): string | undefined {
  if (!summary) {
    return undefined;
  }

  return [summary.finalScore, summary.penaltyScore ? `Pens ${summary.penaltyScore}` : null, `HT ${summary.halftimeScore}`]
    .filter(Boolean)
    .join(" · ");
}

function RoomTitleWithRound({ roomName }: { roomName: string }) {
  if (roomName.trim().toLocaleLowerCase() !== "bon jor wc26") {
    return roomName;
  }

  return (
    <>
      {roomName}
      <sup className="round-superscript">R32</sup>
    </>
  );
}

function scoreRefreshMessage(scores: string | undefined): string | undefined {
  if (scores === "pending") {
    return "Scores checked. No provider update yet.";
  }

  if (scores === "error") {
    return "Could not refresh scores right now.";
  }

  return undefined;
}

function latestRefreshLabel(matches: AppMatch[]): string | null {
  const latestSyncedAt = matches
    .map((match) => match.lastSyncedAt)
    .filter((syncedAt): syncedAt is string => Boolean(syncedAt))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return latestSyncedAt ? formatRefreshTimeInIst(latestSyncedAt) : null;
}

async function buildShareLink(slug: string, inviteCode?: string): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "gamebling.app";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  const inviteQuery = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : "";

  return `${protocol}://${host}/r/${slug}${inviteQuery}`;
}

function isDemoRoomSlug(slug: string): boolean {
  return slug.startsWith("demo-room-");
}
