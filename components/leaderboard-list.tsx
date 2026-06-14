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
