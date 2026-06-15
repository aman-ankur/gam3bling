import Link from "next/link";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
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
import { joinRoom } from "@/features/rooms/actions";
import { getRoomSummary } from "@/features/rooms/data";
import { formatKickoffInIst } from "@/features/time/match-time";

type RoomPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    error?: string;
    hub?: string;
    invite?: string;
  }>;
};

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { slug } = await params;
  const { error, hub, invite } = await searchParams;
  const room = await getRoomSummary(slug);
  const session = await getPlayerSessionForRoom(slug);
  const shouldShowHub = hub === "1" || Boolean(session);

  if (!room.exists) {
    return <RoomMissing slug={slug} />;
  }

  if (shouldShowHub) {
    const [matches, leaderboard] = await Promise.all([getUpcomingMatches(), getRoomLeaderboard(slug)]);
    const openMatchIds = getOpenPredictionMatchIds(matches);
    const openMatches = matches.filter((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId)).slice(0, 4);
    const featuredMatch = openMatches[0];
    const otherOpenMatches = openMatches.slice(1);
    const currentPlayerScore = session ? leaderboard.find((entry) => entry.playerId === session.playerId)?.score : undefined;

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
                awayTeam={featuredMatch.awayTeam}
                featured
                homeTeam={featuredMatch.homeTeam}
                href={`/r/${slug}/matches/${featuredMatch.apiMatchId}`}
                kickoffAt={featuredMatch.kickoffAt}
                progress="Room predictions hidden until saved"
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
                <OtherOpenMatchLink key={match.id} match={match} slug={slug} />
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
              leaderboard.slice(0, 3).map((entry) => (
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
          <div className="history-preview">
            <strong>Completed matches will appear here</strong>
            <span>Round winners, exact-score hits, and score changes will live in this section.</span>
          </div>
        </section>
      </AppShell>
    );
  }

  const joinAction = joinRoom.bind(null, slug);
  const visibleInvite = invite ?? (room.id === "fallback-room" ? "TIGER7" : undefined);
  const shareLink = await buildShareLink(slug, visibleInvite);

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle="Invite friends">
      <section className="hero-card setup-hero" aria-labelledby="join-room-title">
        <div className="cup-mark">GB</div>
        <p className="eyebrow">World Cup 2026</p>
        <h1 id="join-room-title">Join {room.name}</h1>
        <p>Short link, one invite code, and your display name. No email circus.</p>
      </section>

      {error ? <p className="locked-banner">Check the room code and try again.</p> : null}

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

function OtherOpenMatchLink({ match, slug }: { match: AppMatch; slug: string }) {
  const matchTitle = `${match.homeTeam.name} vs ${match.awayTeam.name}`;

  return (
    <Link
      aria-label={`Predict ${matchTitle}`}
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
      <span>Predict</span>
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
