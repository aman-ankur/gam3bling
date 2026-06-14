import { AppShell } from "@/components/app-shell";
import { MatchCard } from "@/components/match-card";
import { getUpcomingMatches } from "@/features/matches/data";
import { getOpenPredictionMatchIds } from "@/features/matches/prediction-window";
import { getRoomSummary } from "@/features/rooms/data";

type MatchesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function MatchesPage({ params }: MatchesPageProps) {
  const { slug } = await params;
  const [matches, room] = await Promise.all([getUpcomingMatches(), getRoomSummary(slug)]);
  const openMatchIds = getOpenPredictionMatchIds(matches);
  const openMatches = matches.filter((match) => openMatchIds.has(match.id) || openMatchIds.has(match.apiMatchId));
  const lockedMatchCount = Math.max(matches.length - openMatches.length, 0);

  console.info("[matches.list] loaded", {
    slug,
    totalMatches: matches.length,
    openMatches: openMatches.length
  });

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle="Match center">
      <section className="section-stack" aria-labelledby="matches-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Predict next</p>
            <h1 id="matches-title">Predictions lock soon</h1>
          </div>
          <span className="status-chip">{openMatches.length} open</span>
        </div>

        <div className="match-list">
          {openMatches.map((match, index) => (
            <MatchCard
              awayTeam={match.awayTeam.name}
              featured={index === 0}
              homeTeam={match.homeTeam.name}
              href={`/r/${slug}/matches/${match.apiMatchId}`}
              key={match.id}
              kickoffAt={match.kickoffAt}
              progress="5 predictions · closes at kickoff"
              stage={match.stage}
              status="open"
            />
          ))}
        </div>

        {lockedMatchCount > 0 ? (
          <div className="locked-summary">
            <strong>{lockedMatchCount} later fixtures locked</strong>
            <span>They unlock automatically as they enter the next 4 match window.</span>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
