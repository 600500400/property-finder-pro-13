// Parse the FLOOR area of a house out of free text, together with WHICH label the
// number carried ("užitná" / "obytná" / "zastavěná" / none). The label matters:
// ČSÚ prices houses per m² of *obytná* plocha, portals mostly publish *užitná*
// plocha, and "zastavěná plocha" is a different measure again — collapsing them
// silently is what made our Kč/m² incomparable with ČSÚ.
//
// Land area ("pozemek 544 m²") must never be mistaken for floor area, so every
// pattern requires an explicit building word right before the number, and any
// match whose number is introduced by a plot word is rejected.

const LAND_WORDS = /pozem|zahrad|parcel|orn[aá]|louk|les/i;

export type AreaType = "uzitna" | "obytna" | "zastavena" | "unlabelled";

export interface FloorArea {
  value: number;
  areaType: AreaType;
}

const PATTERNS: RegExp[] = [
  // "užitná plocha cca 152 m²", "zastavěná plocha 130 m2", "podlahová výměra 90 m²"
  /(?:u[žz]itn[áa]|obytn[áa]|podlahov[áa]|zastav[ěe]n[áa])\s*(?:ploch\w*|vým[ěe]r\w*)\s*(?:domu\s*)?(?:o\s*)?(?:cca\s*|p[řr]ibli[žz]n[ěe]\s*)?:?\s*([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
  // "s užitnou plochou přibližně 152 m²"
  /(?:u[žz]itnou|obytnou|podlahovou|zastav[ěe]nou)\s+plochou\s*(?:o\s*)?(?:cca\s*|p[řr]ibli[žz]n[ěe]\s*)?([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
  // "dům 89 m²", "prodej domu 94 m²", "RD 6+1 205 m2", "chalupa 94 m²", "dřevostavba 78 m2"
  /(?:rodinn\w*\s+d\w+|d[ůu]m|domu|domku|domek|\bRD\b|chalup\w*|chat\w*|vil\w*|d[řr]evostavb\w*|nemovitost\w*)\s*(?:[0-9]\s*\+\s*[0-9a-zA-Zkk]{1,3}\s*)?(?:o\s*(?:ploše|vým[ěe]ře)\s*)?(?:cca\s*)?([\d][\d\s.,\u00a0]{0,7})\s*m\s*[2²]/i,
];

// "podlahová plocha" is a floor-area concept, closest in practice to užitná plocha.
function labelOf(matched: string): AreaType {
  if (/u[žz]itn/i.test(matched)) return "uzitna";
  if (/obytn/i.test(matched)) return "obytna";
  if (/zastav[ěe]n/i.test(matched)) return "zastavena";
  if (/podlahov/i.test(matched)) return "uzitna";
  return "unlabelled";
}

export function parseFloorAreaDetailed(text: string | null | undefined): FloorArea | undefined {
  if (!text) return undefined;
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    // Reject when a plot word sits immediately before the number.
    const prefix = m[0].slice(0, m[0].length - m[1].length);
    if (LAND_WORDS.test(prefix)) continue;
    const digits = m[1].replace(/[^\d]/g, "");
    if (!digits) continue;
    const n = parseInt(digits, 10);
    // Sanity: a habitable house floor area outside 20–1000 m² is almost always a bad parse.
    if (!Number.isFinite(n) || n < 20 || n > 1000) continue;
    return { value: n, areaType: labelOf(prefix) };
  }
  return undefined;
}

export function parseFloorArea(text: string | null | undefined): number | undefined {
  return parseFloorAreaDetailed(text)?.value;
}

// When a source publishes a structured area field we do not see a label at all;
// look the label up in the surrounding free text so at least explicit
// "zastavěná plocha" listings can be excluded from calibration.
export function areaTypeFromText(text: string | null | undefined): AreaType {
  if (!text) return "unlabelled";
  if (/u[žz]itn\w*\s*(?:ploch|vým)/i.test(text)) return "uzitna";
  if (/obytn\w*\s*(?:ploch|vým)/i.test(text)) return "obytna";
  if (/zastav[ěe]n\w*\s*(?:ploch|vým)/i.test(text)) return "zastavena";
  return "unlabelled";
}
