type PredictionReceiptProps = {
  finalScore: string;
  halftimeScore?: string;
  matchLabel: string;
  result?: string;
  scorers?: string;
};

export function PredictionReceipt({ finalScore, halftimeScore, matchLabel, result, scorers }: PredictionReceiptProps) {
  return (
    <section className="prediction-receipt" aria-labelledby="receipt-title">
      <div>
        <p className="eyebrow">Your prediction</p>
        <h2 id="receipt-title">{matchLabel}</h2>
        <p>
          {halftimeScore ? `HT ${halftimeScore}` : "Half-time pending"}
          {result ? ` · ${result}` : ""}
          {scorers ? ` · ${scorers}` : ""}
        </p>
      </div>
      <span>{finalScore}</span>
    </section>
  );
}
