import { MAX_PREDICTION_POINTS, SCORING_RULES, SCORING_SUMMARY } from "@/features/scoring/rules";

type ScoringGuideProps = {
  variant?: "compact" | "details";
};

export function ScoringGuide({ variant = "compact" }: ScoringGuideProps) {
  if (variant === "details") {
    return (
      <details className="scoring-guide scoring-guide-details">
        <summary>
          <span>Scoring</span>
          <b>Max {MAX_PREDICTION_POINTS} pts</b>
        </summary>
        <dl>
          {SCORING_RULES.map((rule) => (
            <div key={rule.label}>
              <dt>{rule.label}</dt>
              <dd>
                {rule.points} pts{"detail" in rule ? ` · ${rule.detail}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    );
  }

  return (
    <section aria-label="Scoring guide" className="scoring-guide">
      <strong>Max {MAX_PREDICTION_POINTS} pts</strong>
      <span>{SCORING_SUMMARY}</span>
    </section>
  );
}
