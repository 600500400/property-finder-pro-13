// Parse the FLOOR (užitná / zastavěná) area of a house out of free text.
// Land area ("pozemek 544 m²") must never be mistaken for floor area, so every
// pattern requires an explicit building word right before the number, and any
// match whose number is introduced by a plot word is rejected.

const LAND_WORDS = /pozem|zahrad|parcel|orn[aá]|louk|les/i;

const PATTERNS: RegExp[] = [
  // "užitná plocha cca 152 m²", "zastavěná plocha 130 m2", "podlahová výměra 90 m²"
  /(?:u[žz]itn[áa]|obytn[áa]|podlahov[áa]|zastav[ěe]n[áa])\s*(?:ploch\w*|vým[ěe]r\w*)\s*(?:domu\s*)?(?:o\s*)?(?:cca\s*|p[řr]ibli[žz]n[ěe]\s*)?:?\s*([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
  // "s užitnou plochou přibližně 152 m²"
  /(?:u[žz]itnou|obytnou|podlahovou|zastav[ěe]nou)\s+plochou\s*(?:o\s*)?(?:cca\s*|p[řr]ibli[žz]n[ěe]\s*)?([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
  // "dům 89 m²", "prodej domu 94 m²", "RD 6+1 205 m2", "chalupa 94 m²", "dřevostavba 78 m2"
  /(?:rodinn\w*\s+d\w+|d[ůu]m|domu|domku|domek|\bRD\b|chalup\w*|chat\w*|vil\w*|d[řr]evostavb\w*|nemovitost\w*)\s*(?:[0-9]\s*\+\s*[0-9a-zA-Zkk]{1,3}\s*)?(?:o\s*(?:ploše|vým[ěe]ře)\s*)?(?:cca\s*)?([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
];

export function parseFloorArea(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    // Reject when a plot word sits immediately before the number.
    const before = text.slice(Math.max(0, m.index), m.index + (m[0].length - m[1].length));
    if (LAND_WORDS.test(before)) continue;
    const digits = m[1].replace(/[^\d]/g, "");
    if (!digits) continue;
    const n = parseInt(digits, 10);
    // Sanity: a habitable house floor area outside 20–1000 m² is almost always a bad parse.
    if (!Number.isFinite(n) || n < 20 || n > 1000) continue;
    return n;
  }
  return undefined;
}
