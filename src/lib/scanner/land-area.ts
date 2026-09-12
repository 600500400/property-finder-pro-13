// Parse "plocha pozemku" out of free text (Bazoš / iDnes titles & descriptions).
// Only unambiguous matches are returned — otherwise undefined (never guess).

const PATTERNS: RegExp[] = [
  /pozemk?[a-zěáíéuy]*\s*(?:o\s*)?(?:vým[eě][rř]e\s*)?(?:cca\s*)?:?\s*([\d][\d\s.,\u00a0]{1,9})\s*m\s*[2²]/i,
  /(?:vým[eě]ra|plocha)\s+pozemku\s*:?\s*(?:cca\s*)?([\d][\d\s.,\u00a0]{1,9})\s*m\s*[2²]/i,
  /([\d][\d\s.,\u00a0]{1,9})\s*m\s*[2²]\s*(?:velk[ýy]\s*)?pozem/i,
];

export function parseLandArea(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const digits = m[1].replace(/[^\d]/g, "");
    if (!digits) continue;
    const n = parseInt(digits, 10);
    // Sanity: plots below 30 m² or above 200 000 m² are almost always a bad parse.
    if (!Number.isFinite(n) || n < 30 || n > 200_000) continue;
    return n;
  }
  return undefined;
}
