import { InlineRefreshButton, type InlineRefreshActionResult } from "@/components/inline-refresh-button";
import type { AppMatch } from "@/features/matches/data";
import type { RoomMatchPick } from "@/features/predictions/data";
import type { ResultCheckState } from "@/features/results/check-window";

type MatchResultBreakdownProps = {
  match: AppMatch;
  pick: RoomMatchPick;
};

type ResultCheckPanelProps = {
  action: () => Promise<InlineRefreshActionResult>;
  state: ResultCheckState;
  resultMessage?: string;
};

export function MatchResultBreakdown({ match, pick }: MatchResultBreakdownProps) {
  if (match.homeScore == null || match.awayScore == null) {
    return null;
  }

  const maxPoints = 29;
  const hitCount = [
    pick.scoreFinal,
    pick.scoreResult,
    pick.scoreHalftime,
    pick.scoreFirstScorer,
    pick.scoreLastScorer
  ].filter((points) => points > 0).length;
  const pendingCount = [
    !match.firstScoringTeamId,
    !match.lastScoringTeamId
  ].filter(Boolean).length;
  const halftimeDetail = match.homeHalftimeScore != null && match.awayHalftimeScore != null
    ? `Predicted ${pick.halftimeScore}, official ${match.homeHalftimeScore}-${match.awayHalftimeScore}`
    : `Predicted HT ${pick.halftimeScore}`;

  return (
    <>
      <section className="post-result-hero" aria-labelledby="post-result-title">
        <p className="eyebrow">{match.groupName ? `${match.groupName} · Final` : `${match.stage} · Final`}</p>
        <h2 id="post-result-title">
          <span>{match.homeTeam.name} {match.homeScore}-{match.awayScore}</span>
          <span>{match.awayTeam.name}</span>
        </h2>
        <p>Your pick: {match.homeTeam.name} {pick.finalScore} {match.awayTeam.name} · HT {pick.halftimeScore}</p>
        <div className="result-chip-row" aria-label="Prediction result summary">
          <span className="result-pill good">+{pick.points} pts</span>
          <span className="result-pill">{hitCount} hits</span>
          <span className="result-pill">{pendingCount} pending</span>
        </div>
      </section>

      <section className="section-stack result-breakdown" aria-labelledby="result-breakdown-title">
        <div className="result-breakdown-heading">
          <div>
            <p className="eyebrow">Your breakdown</p>
            <h2 id="result-breakdown-title">What you got right</h2>
            <p>Scored from official final score and half-time score.</p>
          </div>
          <strong>{pick.points}/{maxPoints}</strong>
        </div>

        <div className="breakdown-list">
          <BreakdownRow detail={`Predicted ${pick.finalScore}, final ${match.homeScore}-${match.awayScore}`} hit={pick.scoreFinal > 0} label="Exact score" points={pick.scoreFinal} />
          <BreakdownRow detail={pick.result ?? "Result prediction"} hit={pick.scoreResult > 0} label="Result" points={pick.scoreResult} />
          <BreakdownRow detail={halftimeDetail} hit={pick.scoreHalftime > 0} label="Half-time" points={pick.scoreHalftime} />
          <BreakdownRow
            detail={teamMarketDetail(match.firstScoringTeamId, pick.scoreFirstScorer, "first")}
            hit={pick.scoreFirstScorer > 0}
            label="First scorer"
            points={pick.scoreFirstScorer}
            pending={!match.firstScoringTeamId}
          />
          <BreakdownRow
            detail={teamMarketDetail(match.lastScoringTeamId, pick.scoreLastScorer, "last")}
            hit={pick.scoreLastScorer > 0}
            label="Last scorer"
            points={pick.scoreLastScorer}
            pending={!match.lastScoringTeamId}
          />
        </div>
      </section>
    </>
  );
}

export function ResultCheckPanel({ action, resultMessage, state }: ResultCheckPanelProps) {
  if (state.reason === "final") {
    return null;
  }

  return (
    <section className="section-stack result-check-panel" aria-labelledby="result-check-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Result sync</p>
          <h2 id="result-check-title">Check final result</h2>
        </div>
        <span className="status-chip">{state.canCheck ? "Ready" : "Waiting"}</span>
      </div>

      {resultMessage ? <p className="result-check-message">{resultMessage}</p> : null}

      {state.canCheck ? (
        <InlineRefreshButton action={action} className="primary-button" pendingLabel="Checking result...">
          Check final result
        </InlineRefreshButton>
      ) : (
        <button className="primary-button" disabled type="button">
          {state.reason === "cooldown" ? "Try again in 5 minutes" : "Opens after expected full time"}
        </button>
      )}

      <p className="result-check-help">
        {state.reason === "cooldown"
          ? "The provider was checked recently. This protects the free-plan API budget."
          : state.reason === "early"
            ? "Result checks open around 115 minutes after kickoff."
            : "If the match is final, scores and leaderboards update immediately."}
      </p>
    </section>
  );
}

function teamMarketDetail(officialTeamId: string | null | undefined, points: number, market: "first" | "last"): string {
  if (!officialTeamId) {
    return "Pending official event-team mapping";
  }

  return points > 0 ? `Team matched official ${market} scorer` : `Missed official ${market} scorer`;
}

function BreakdownRow({
  detail,
  hit,
  label,
  pending,
  points
}: {
  detail: string;
  hit: boolean;
  label: string;
  pending?: boolean;
  points: number;
}) {
  return (
    <div className="breakdown-row">
      <span className={hit ? "breakdown-mark hit" : pending ? "breakdown-mark pending" : "breakdown-mark"}>{hit ? "✓" : pending ? "-" : "×"}</span>
      <div className="breakdown-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <b>{points > 0 ? `+${points}` : "0"}</b>
    </div>
  );
}
