import { AppShell } from "@/components/app-shell";
import { LeaderboardList } from "@/components/leaderboard-list";
import { getGlobalLeaderboard } from "@/features/leaderboards/data";

export default async function GlobalLeaderboardPage() {
  const globalLeaders = await getGlobalLeaderboard();

  return (
    <AppShell roomName="All rooms" subtitle="World Cup rankings">
      <section className="section-stack" aria-labelledby="global-leaderboard-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Leaderboard</p>
            <h1 id="global-leaderboard-title">Global leaderboard</h1>
          </div>
          <span className="status-chip">Global</span>
        </div>
        <div className="projection-card leaderboard-summary">
          <p>Top 11% across all active World Cup rooms.</p>
        </div>
        <LeaderboardList entries={globalLeaders} label="Global leaderboard rankings" />
      </section>
    </AppShell>
  );
}
