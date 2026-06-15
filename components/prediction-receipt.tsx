import { TeamName } from "@/components/team-name";
import type { AppTeam } from "@/features/matches/data";

type PredictionReceiptProps = {
  awayTeam: AppTeam;
  finalScore: string;
  firstScoringTeamId?: string;
  halftimeScore?: string;
  homeTeam: AppTeam;
  lastScoringTeamId?: string;
  result?: "home" | "away" | "draw";
};

export function PredictionReceipt({
  awayTeam,
  finalScore,
  firstScoringTeamId,
  halftimeScore,
  homeTeam,
  lastScoringTeamId,
  result
}: PredictionReceiptProps) {
  return (
    <section className="prediction-receipt" aria-labelledby="receipt-title">
      <div>
        <p className="eyebrow">Your prediction</p>
        <h2 aria-label={`${homeTeam.name} ${finalScore} ${awayTeam.name}`} id="receipt-title">
          <TeamName team={homeTeam} />
          {" "}
          <span>{finalScore}</span>
          {" "}
          <TeamName team={awayTeam} />
        </h2>
        <p>
          {halftimeScore ? `HT ${halftimeScore}` : "Half-time pending"}
          {result ? (
            <>
              {" · "}
              <ResultLabel awayTeam={awayTeam} homeTeam={homeTeam} result={result} />
            </>
          ) : null}
          {firstScoringTeamId || lastScoringTeamId ? (
            <>
              {" · "}
              <ScorersLabel
                awayTeam={awayTeam}
                firstScoringTeamId={firstScoringTeamId}
                homeTeam={homeTeam}
                lastScoringTeamId={lastScoringTeamId}
              />
            </>
          ) : null}
        </p>
      </div>
      <span>{finalScore}</span>
    </section>
  );
}

function ResultLabel({
  awayTeam,
  homeTeam,
  result
}: {
  awayTeam: AppTeam;
  homeTeam: AppTeam;
  result: "home" | "away" | "draw";
}) {
  if (result === "home") {
    return <TeamName team={homeTeam} />;
  }

  if (result === "away") {
    return <TeamName team={awayTeam} />;
  }

  return <span>Draw</span>;
}

function ScorersLabel({
  awayTeam,
  firstScoringTeamId,
  homeTeam,
  lastScoringTeamId
}: {
  awayTeam: AppTeam;
  firstScoringTeamId?: string;
  homeTeam: AppTeam;
  lastScoringTeamId?: string;
}) {
  const firstTeam = teamFromId(firstScoringTeamId, homeTeam, awayTeam);
  const lastTeam = teamFromId(lastScoringTeamId, homeTeam, awayTeam);

  if (!firstTeam || !lastTeam) {
    return <span>No goals</span>;
  }

  return (
    <span className="inline-team-sequence">
      <TeamName team={firstTeam} />
      <span>first,</span>
      <TeamName team={lastTeam} />
      <span>last</span>
    </span>
  );
}

function teamFromId(teamId: string | undefined, homeTeam: AppTeam, awayTeam: AppTeam): AppTeam | null {
  if (teamId === homeTeam.id) {
    return homeTeam;
  }

  if (teamId === awayTeam.id) {
    return awayTeam;
  }

  return null;
}
