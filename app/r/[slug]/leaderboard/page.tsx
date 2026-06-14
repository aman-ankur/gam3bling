import { AppShell } from "@/components/app-shell";
import { LeaderboardList } from "@/components/leaderboard-list";
import { getRoomLeaderboard } from "@/features/leaderboards/data";
import { getRoomSummary } from "@/features/rooms/data";

type RoomLeaderboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function RoomLeaderboardPage({ params }: RoomLeaderboardPageProps) {
  const { slug } = await params;
  const [roomLeaders, room] = await Promise.all([getRoomLeaderboard(slug), getRoomSummary(slug)]);

  return (
    <AppShell roomName={room.name} roomSlug={slug} subtitle="Leaderboard">
      <section className="section-stack" aria-labelledby="room-leaderboard-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Leaderboard</p>
            <h1 id="room-leaderboard-title">Room leaderboard</h1>
          </div>
          <span className="status-chip">Room</span>
        </div>
        <LeaderboardList entries={roomLeaders} label="Room leaderboard rankings" />
      </section>
    </AppShell>
  );
}
