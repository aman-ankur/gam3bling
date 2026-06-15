import { TeamName } from "@/components/team-name";
import type { AppMatch } from "@/features/matches/data";
import type { MatchTeamStatisticView } from "@/features/match-details/types";

type MatchStatsPanelProps = {
  match: AppMatch;
  statistics: MatchTeamStatisticView[];
};

export function MatchStatsPanel({ match, statistics }: MatchStatsPanelProps) {
  const groupedStats = groupStats(statistics, match);

  return (
    <article className="section-stack match-detail-panel" aria-labelledby="stats-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Match facts</p>
          <h2 id="stats-title">Stats</h2>
        </div>
        <span className="status-chip">{match.status}</span>
      </div>

      {groupedStats.length > 0 ? (
        <div className="stats-list">
          <div className="stats-teams">
            <strong>
              <TeamName team={match.homeTeam} />
            </strong>
            <strong>
              <TeamName team={match.awayTeam} />
            </strong>
          </div>
          {groupedStats.map((stat) => (
            <div className="stat-comparison" key={stat.name}>
              <b>{stat.homeValue ?? "-"}</b>
              <span>{stat.name}</span>
              <b>{stat.awayValue ?? "-"}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="section-note">Stats are not available yet.</p>
      )}
    </article>
  );
}

function groupStats(statistics: MatchTeamStatisticView[], match: AppMatch): Array<{
  name: string;
  homeValue: string | null;
  awayValue: string | null;
}> {
  const statNames = [...new Set(statistics.map((stat) => stat.statName))];

  return statNames.map((name) => {
    const matching = statistics.filter((stat) => stat.statName === name);

    return {
      name,
      homeValue: matching.find((stat) => stat.teamId === match.homeTeam.id)?.statValue ?? null,
      awayValue: matching.find((stat) => stat.teamId === match.awayTeam.id)?.statValue ?? null
    };
  });
}
