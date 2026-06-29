const KNOCKOUT_STAGE_PATTERNS = [
  /\br(?:ound)?\s*of\s*32\b/i,
  /\br(?:ound)?\s*of\s*16\b/i,
  /\br32\b/i,
  /\br16\b/i,
  /\bknockout\b/i,
  /\bquarter-?finals?\b/i,
  /\bsemi-?finals?\b/i,
  /\bthird place\b/i,
  /^final$/i
];

export function isKnockoutStage(stage: string | null | undefined): boolean {
  const normalizedStage = stage?.trim();

  return Boolean(normalizedStage && KNOCKOUT_STAGE_PATTERNS.some((pattern) => pattern.test(normalizedStage)));
}
