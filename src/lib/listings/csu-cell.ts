/**
 * Parsing of raw ČSÚ spreadsheet cells.
 *
 * The published tables mark low-sample values with a footnote INSIDE the cell:
 * the cell literally contains `    78 541  1)` rather than a number. Stripping
 * every non-digit character (the original import) folded the footnote marker's
 * digit into the value: "36 732  1)" -> 367321, i.e. exactly value * 10 + 1.
 * That produced 14 corrupt band prices (okres Písek: 617 806 "Kč/m²").
 *
 * Missing data is published as `x` (not applicable) or `i.d.` (individual data
 * withheld) — both mean "no value", never zero.
 */

export const CSU_BAND_PRICE_MIN = 10_000;
export const CSU_BAND_PRICE_MAX = 300_000;

const NO_DATA = new Set(["x", "i.d.", "i. d.", "-", "–", "—", "..", ".", ""]);
const FOOTNOTE = /\s*\d\)\s*$/;

export interface CsuCell {
  value: number | null;
  /** Cell carried a footnote marker: "malý počet údajů k dispozici". */
  lowSample: boolean;
  error?: string;
}

export function parseCsuCell(raw: unknown): CsuCell {
  if (raw === null || raw === undefined) return { value: null, lowSample: false };
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { value: Math.round(raw), lowSample: false } : { value: null, lowSample: false };
  }
  if (typeof raw !== "string") return { value: null, lowSample: false, error: `unsupported cell type ${typeof raw}` };

  const text = raw.replace(/\u00a0/g, " ").trim();
  if (NO_DATA.has(text.toLowerCase())) return { value: null, lowSample: false };

  const lowSample = FOOTNOTE.test(text);
  const body = text.replace(FOOTNOTE, "").trim();
  if (NO_DATA.has(body.toLowerCase())) return { value: null, lowSample };

  // Only digits and thousand separators may remain — anything else is unexpected
  // and must fail loudly instead of being silently coerced into a number.
  if (!/^\d[\d\s.]*$/.test(body)) return { value: null, lowSample, error: `unparsable cell: ${JSON.stringify(raw)}` };
  const digits = body.replace(/[\s.]/g, "");
  if (!digits) return { value: null, lowSample };
  return { value: Number(digits), lowSample };
}

/** Same as parseCsuCell plus a sanity range for Kč/m² prices. */
export function parseCsuBandPrice(raw: unknown): CsuCell {
  const cell = parseCsuCell(raw);
  if (cell.error || cell.value === null) return cell;
  if (cell.value < CSU_BAND_PRICE_MIN || cell.value > CSU_BAND_PRICE_MAX) {
    return { value: null, lowSample: cell.lowSample, error: `band price out of range: ${cell.value} (${JSON.stringify(raw)})` };
  }
  return cell;
}
