import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CountdownTimer } from "@/components/countdown-timer";
import { LiveMatchClock } from "@/components/live-match-clock";
import { ScoringGuide } from "@/components/scoring-guide";
import { SubmitButton } from "@/components/submit-button";
import { MatchupName, TeamName } from "@/components/team-name";
import { createDemoRoom } from "@/features/demo/actions";
import { getUpcomingMatches } from "@/features/matches/data";
import { getActiveMatchIds, getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { joinRoomByCode } from "@/features/rooms/actions";
import { getCurrentPlayerRoomShortcuts } from "@/features/rooms/data";
import { formatKickoffInIst } from "@/features/time/match-time";
import { getCurrentDate } from "@/features/time/now";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    demo?: string;
    demoError?: string;
    joinError?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { demo, demoError, joinError } = await searchParams;
  const matches = await getUpcomingMatches();
  const roomShortcuts = await getCurrentPlayerRoomShortcuts();
  const now = getCurrentDate();
  const initialNow = now.toISOString();
  const activeMatchIds = getActiveMatchIds(matches, now);
  const openMatchIds = getOpenPredictionMatchIds(matches, now);
  const activeMatches = matches.filter((match) => activeMatchIds.has(match.id) || activeMatchIds.has(match.apiMatchId));
  const openMatches = matches.filter((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId));
  const previewMatches = [...activeMatches, ...openMatches.filter((match) => !activeMatchIds.has(match.id) && !activeMatchIds.has(match.apiMatchId))].slice(0, 3);

  return (
    <AppShell roomName="Gam3bling">
      <section className="hero-card" aria-labelledby="home-title">
        <p className="eyebrow">World Cup prediction rooms</p>
        <h1 id="home-title">Gam3bling</h1>
        <p>
          Create a room, invite friends, lock predictions before kickoff, and climb the
          leaderboard when the results land.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/new">
            Create room
          </Link>
        </div>
      </section>

      {demo === "1" ? (
        <section className="section-stack demo-launch-panel" aria-labelledby="demo-launch-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Demo mode</p>
              <h2 id="demo-launch-title">Simulate post-match scoring</h2>
            </div>
            <span className="status-chip">Hidden</span>
          </div>
          {demoError ? <p className="locked-banner">Demo setup is not available in this environment.</p> : null}
          <form action={createDemoRoom} className="demo-launch-form">
            <SubmitButton className="secondary-button" pendingLabel="Creating demo...">Create demo room</SubmitButton>
          </form>
        </section>
      ) : null}

      {roomShortcuts.length > 0 ? (
        <section className="section-stack room-shortcuts" aria-labelledby="your-rooms-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Continue</p>
              <h2 id="your-rooms-title">Your rooms</h2>
            </div>
            <span className="status-chip">{roomShortcuts.length} active</span>
          </div>

          {roomShortcuts.map((room) => (
            <Link className="room-shortcut-card" href={room.href} key={room.slug}>
              <div>
                <strong>{room.name}</strong>
                <span>
                  {room.nextMatch ? (
                    <MatchupName awayTeam={room.nextMatch.awayTeam} homeTeam={room.nextMatch.homeTeam} />
                  ) : (
                    room.nextMatchLabel
                  )}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Saved</dt>
                  <dd>{room.savedCount}</dd>
                </div>
                <div>
                  <dt>Score</dt>
                  <dd>{room.score}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="section-stack join-room-panel" aria-labelledby="join-home-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Have an invite?</p>
            <h2 id="join-home-title">Join a room</h2>
          </div>
        </div>

        {joinError ? <p className="locked-banner">Check the room code and try again.</p> : null}

        <form action={joinRoomByCode} className="form-card home-join-form" aria-label="Join room by code form">
          <label>
            Room code
            <input aria-label="Room code" autoComplete="off" inputMode="text" name="inviteCode" placeholder="TIGER7" />
          </label>
          <label>
            Your display name
            <input aria-label="Your display name" autoComplete="name" name="displayName" placeholder="John" />
          </label>
          <SubmitButton pendingLabel="Joining room...">Join room</SubmitButton>
        </form>
      </section>

      <section className="section-stack" aria-labelledby="next-fixtures-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Predict next</p>
            <h2 id="next-fixtures-title">{activeMatches.length > 0 ? "Live fixtures" : "Next fixtures"}</h2>
          </div>
          <span className="status-chip">{activeMatches.length > 0 ? `${activeMatches.length} live` : `${openMatches.length} open`}</span>
        </div>

        {previewMatches.map((match) => {
          const isActive = activeMatchIds.has(match.id) || activeMatchIds.has(match.apiMatchId);
          const scoreText = match.homeScore != null && match.awayScore != null ? `${match.homeScore}-${match.awayScore}` : "vs";

          return (
            <article className="match-ticket home-fixture" key={match.id}>
              <div className="ticket-meta">
                <span>{match.stage}</span>
                <strong>
                  {isActive ? (
                    <LiveMatchClock initialNow={initialNow} kickoffAt={match.kickoffAt} status="live" />
                  ) : (
                    <CountdownTimer kickoffAt={match.kickoffAt} />
                  )}
                </strong>
              </div>
              <p className="kickoff-line">{isActive ? "Live score" : formatKickoffInIst(match.kickoffAt)}</p>
              <div className="team-row">
                <b>
                  <TeamName team={match.homeTeam} />
                </b>
                <span className={isActive && scoreText !== "vs" ? "home-live-score" : undefined}>{scoreText}</span>
                <b>
                  <TeamName team={match.awayTeam} />
                </b>
              </div>
              <div className="ticket-footer">
                <span>{isActive ? "Live now" : "Open for predictions"}</span>
                <span>{scoreText !== "vs" ? "Score synced" : "Next 4 window"}</span>
              </div>
            </article>
          );
        })}

        <Link className="secondary-button compact-link" href="/new">
          Create a room to predict
        </Link>
      </section>

      <section className="section-stack" aria-labelledby="scoring-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Points</p>
            <h2 id="scoring-title">Scoring</h2>
          </div>
        </div>
        <ScoringGuide variant="details" />
      </section>
    </AppShell>
  );
}
