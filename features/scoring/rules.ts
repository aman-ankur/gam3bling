export const SCORING_RULES = [
  { label: "Exact score", points: 10 },
  { label: "Result", points: 5 },
  { label: "Half-time", points: 6 },
  { label: "First team to score", points: 4 },
  { label: "Last team to score", points: 4 }
] as const;

export const MAX_PREDICTION_POINTS = SCORING_RULES.reduce((total, rule) => total + rule.points, 0);

export const SCORING_SUMMARY = "Exact 10 · Result 5 · HT 6 · First/last 4 each";
