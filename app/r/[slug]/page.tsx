import Link from "next/link";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { LatestResultCard } from "@/components/latest-result-card";
import { MatchCard } from "@/components/match-card";
import { MemberList } from "@/components/member-list";
import { RoomInviteCard } from "@/components/room-invite-card";
import { RoomMissing } from "@/components/room-missing";
import { ScoringGuide } from "@/components/scoring-guide";
import { SubmitButton } from "@/components/submit-button";
import { TeamName } from "@/components/team-name";
import { getRoomLeaderboard } from "@/features/leaderboards/data";
import { getUpcomingMatches } from "@/features/matches/data";
import type { AppMatch } from "@/features/matches/data";
import { getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getPlayerSessionForRoom } from "@/features/players/session";
import { getCurrentPlayerPredictedMatchIds, getRoomMatchPicks } from "@/features/predictions/data";
import { claimRoomPlayer, deleteRoom, joinRoom, rememberRoomInviteCode, removeRoomMember } from "@/features/rooms/actions";
import { getRoomSummary, type RoomSummary } from "@/features/rooms/data";
import { formatKickoffInIst } from "@/features/time/match-time";

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
  }>;
};

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { slug } = await params;
  const { admin, adminError, claimName, claimPlayerId, error, hub, invite, inviteError } = await searchParams;
  const room = await getRoomSummary(slug);
  const session = await getPlayerSessionForRoom(slug);
  const shouldShowHub = hub === "1" || Boolean(session);

  if (!room.exists) {
    return <RoomMissing slug={slug} />;
  }

  if (shouldShowHub) {
    const matches = await getUpcomingMatches();
    const latestCompletedMatch = getLatestCompletedMatch(matches);
    const [leaderboard, predictedMatchIds] = await Promise.all([
      getRoomLeaderboard(slug),
      getCurrentPlayerPredictedMatchIds(slug, matches)
    ]);
    const latestResultPicks = latestCompletedMatch ? await getRoomMatchPicks(slug, latestCompletedMatch) : [];
    const openMatchIds = getOpenPredictionMatchIds(matches);
    const openMatches = matches.filter((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId)).slice(0, 4);
    const featuredMatch = openMatches[0];
    const otherOpenMatches = openMatches.slice(1);
    const currentPlayerScore = session ? leaderboard.find((entry) => entry.playerId === session.playerId)?.score : undefined;
    const visibleInvite = room.inviteCode ?? invite ?? (room.id === "fallback-room" ? "TIGER7" : undefined);
    const shareLink = await buildShareLink(slug, visibleInvite);
    const recoverInviteAction = rememberRoomInviteCode.bind(null, slug);
    const isRoomCreator = Boolean(session && room.creatorPlayerId && session.playerId === room.creatorPlayerId);

    return (
      <AppShell roomName={room.name} roomSlug={slug} subtitle="Room hub">
        <section className="hero-card room-hub-hero" aria-labelledby="room-hub-title">
          <p className="eyebrow">Room command center</p>
          <h1 id="room-hub-title">{room.name}</h1>
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current round</p>
              <h2 id="room-current-title">Predict next</h2>
            </div>
            <span className="status-chip">{openMatches.length} open</span>
          </div>
          <div className="match-list">
            {featuredMatch ? (
              <MatchCard
                actionLabel={predictedMatchIds.has(featuredMatch.id) || predictedMatchIds.has(featuredMatch.apiMatchId) ? "Show prediction" : "Predict"}
                awayTeam={featuredMatch.awayTeam}
                featured
                homeTeam={featuredMatch.homeTeam}
                href={`/r/${slug}/matches/${featuredMatch.apiMatchId}`}
                kickoffAt={featuredMatch.kickoffAt}
                progress={predictedMatchIds.has(featuredMatch.id) || predictedMatchIds.has(featuredMatch.apiMatchId) ? "Your prediction is saved" : "Room predictions hidden until saved"}
                stage={featuredMatch.stage}
                status="open"
                variant="sport"
              />
            ) : null}
          </div>

          {otherOpenMatches.length > 0 ? (
            <div className="other-open-matches" aria-label="Other open matches">
              <p className="eyebrow">Other open matches</p>
              {otherOpenMatches.map((match) => (
                <OtherOpenMatchLink
                  isSaved={predictedMatchIds.has(match.id) || predictedMatchIds.has(match.apiMatchId)}
                  key={match.id}
                  match={match}
                  slug={slug}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="section-stack" aria-labelledby="room-score-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Room score</p>
              <h2 id="room-score-title">Room score</h2>
            </div>
          </div>
          <ol className="compact-leader-list">
            {leaderboard.length > 0 ? (
              leaderboard.slice(0, 4).map((entry) => (
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
        </section>

        <section className="section-stack" aria-labelledby="room-history-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Results ledger</p>
              <h2 id="room-history-title">History</h2>
            </div>
          </div>
          {latestCompletedMatch ? (
            <LatestResultCard match={latestCompletedMatch} picks={latestResultPicks} slug={slug} />
          ) : (
            <div className="history-preview">
              <strong>Completed matches will appear here</strong>
              <span>Round winners, exact-score hits, and score changes will live in this section.</span>
            </div>
          )}
        </section>

        <RoomInviteCard
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
            members={room.members}
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
    <section className="section-stack admin-room-panel" aria-labelledby="room-admin-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2 id="room-admin-title">Manage room</h2>
        </div>
        <span className="status-chip">Creator only</span>
      </div>

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
    </section>
  );
}

function getLatestCompletedMatch(matches: AppMatch[]): AppMatch | undefined {
  return matches
    .filter((match) => match.status === "final" && match.homeScore != null && match.awayScore != null)
    .sort((left, right) => new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime())[0];
}

function OtherOpenMatchLink({ isSaved, match, slug }: { isSaved: boolean; match: AppMatch; slug: string }) {
  const matchTitle = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const actionLabel = isSaved ? "Show" : "Predict";

  return (
    <Link
      aria-label={`${isSaved ? "Show prediction" : "Predict"} ${matchTitle}`}
      className="other-open-match-row"
      href={`/r/${slug}/matches/${match.apiMatchId}`}
    >
      <div>
        <strong>
          <TeamName team={match.homeTeam} />
          <span>vs</span>
          <TeamName team={match.awayTeam} />
        </strong>
        <small>{formatKickoffInIst(match.kickoffAt)}</small>
      </div>
      <span>{actionLabel}</span>
    </Link>
  );
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
