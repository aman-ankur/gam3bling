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
  const detailParts = [
    halftimeScore ? `HT ${halftimeScore}` : "Half-time pending",
    result ? resultText(awayTeam, homeTeam, result) : null,
    firstScoringTeamId || lastScoringTeamId
      ? scorersText(awayTeam, firstScoringTeamId, homeTeam, lastScoringTeamId)
      : null
  ].filter(Boolean);

  return (
    <section className="prediction-receipt" aria-labelledby="receipt-title">
      <div>
        <p className="eyebrow">Your prediction</p>
        <h2 className="prediction-scoreline" aria-label={`${homeTeam.name} ${finalScore} ${awayTeam.name}`} id="receipt-title">
          <span>{homeTeam.name}</span>
          <b>{finalScore}</b>
          <span>{awayTeam.name}</span>
        </h2>
        <div className="prediction-receipt-meta">
          {detailParts.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function resultText(awayTeam: AppTeam, homeTeam: AppTeam, result: "home" | "away" | "draw") {
  if (result === "home") {
    return `${homeTeam.name} win`;
  }

  if (result === "away") {
    return `${awayTeam.name} win`;
  }

  return "Draw";
}

function scorersText(awayTeam: AppTeam, firstScoringTeamId: string | undefined, homeTeam: AppTeam, lastScoringTeamId: string | undefined) {
  const firstTeam = teamFromId(firstScoringTeamId, homeTeam, awayTeam);
  const lastTeam = teamFromId(lastScoringTeamId, homeTeam, awayTeam);

  if (!firstTeam || !lastTeam) {
    return "No goals";
  }

  return `${firstTeam.name} first, ${lastTeam.name} last`;
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
