import { Avatar } from "@/components/avatar";

type LeaderboardEntry = {
  rank: number;
  name: string;
  initials: string;
  score: number;
  secondaryStat: string;
  tone?: string;
};

type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  label: string;
};

export function LeaderboardList({ entries, label }: LeaderboardListProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state" role="status">
        <strong>No scored predictions yet</strong>
        <span>Scores will appear after completed matches are synced.</span>
      </div>
    );
  }

  return (
    <ol aria-label={label} className="leaderboard-list">
      {entries.map((entry) => (
        <li key={`${entry.rank}-${entry.name}`}>
          <span className="rank">{entry.rank}</span>
          <Avatar initials={entry.initials} tone={entry.tone} />
          <span className="leader-meta">
            <b>{entry.name}</b>
            <small>{entry.secondaryStat}</small>
          </span>
          <strong>{entry.score} pts</strong>
        </li>
      ))}
    </ol>
  );
}
