/**
 * Deterministic, statistically neutral comparable-listing sampling for AI analysis.
 *
 * Rules (Priorita 4):
 *  - the eligible sample is built FIRST, the median is computed from the WHOLE sample,
 *  - the prompt only receives a bounded, deterministic, representative subsample,
 *  - nothing depends on input order or on picking the cheapest listings.
 *
 * Pure module: no DB, no network — fully unit-testable.
 */

export interface CompCandidate {
  id: string;
  price: number | null;
  area_m2: number | null;
  city: string | null;
  kraj: string | null;
  property_type: string | null;
  deal_type: string | null;
  is_active?: boolean | null;
}

export interface CompSubject {
  id: string;
  price: number;
  area_m2: number | null;
  kraj: string | null;
  property_type: string | null;
  deal_type: string | null;
}

export interface ComparableItem {
  id: string;
  price: number;
  area_m2: number;
  city: string | null;
  pricePerM2: number;
}

export interface ComparableSummary {
  /** Bounded deterministic subsample handed to the AI prompt. */
  sample: ComparableItem[];
  /** Size of the FULL eligible sample the median was computed from. */
  sample_count: number;
  median_ppm: number | null;
  own_ppm: number | null;
  pct_vs_median: number | null;
}

/** Area tolerance for a comparable listing. */
export const AREA_TOLERANCE = 0.2;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Eligible = same kraj + property_type + deal_type, active, area ±20 %, valid price/area, not the subject. */
export function eligibleComparables(subject: CompSubject, candidates: CompCandidate[]): ComparableItem[] {
  if (!subject.kraj || !subject.property_type || !subject.deal_type) return [];
  if (!subject.area_m2 || subject.area_m2 <= 0) return [];
  const lo = subject.area_m2 * (1 - AREA_TOLERANCE);
  const hi = subject.area_m2 * (1 + AREA_TOLERANCE);

  const out: ComparableItem[] = [];
  for (const c of candidates) {
    if (!c.id || c.id === subject.id) continue;
    if (c.is_active === false) continue;
    if (c.kraj !== subject.kraj) continue;
    if (c.property_type !== subject.property_type) continue;
    if (c.deal_type !== subject.deal_type) continue;
    if (!c.price || c.price <= 0) continue;
    if (!c.area_m2 || c.area_m2 <= 0) continue;
    if (c.area_m2 < lo || c.area_m2 > hi) continue;
    out.push({
      id: c.id,
      price: c.price,
      area_m2: c.area_m2,
      city: c.city,
      pricePerM2: Math.round(c.price / c.area_m2),
    });
  }
  // Stable order independent of the DB's row order.
  out.sort((a, b) => (a.pricePerM2 - b.pricePerM2) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * Even spread across the price distribution of the sorted eligible sample,
 * always including the median item. Deterministic for a given sample.
 */
export function representativeSubsample(sorted: ComparableItem[], max: number): ComparableItem[] {
  if (max <= 0) return [];
  if (sorted.length <= max) return [...sorted];
  const n = sorted.length;
  const idx = new Set<number>();
  for (let i = 0; i < max; i++) idx.add(Math.round((i * (n - 1)) / (max - 1)));
  idx.add(Math.floor((n - 1) / 2));
  return [...idx].sort((a, b) => a - b).slice(0, max).map(i => sorted[i]);
}

export function buildComparables(
  subject: CompSubject,
  candidates: CompCandidate[],
  maxPromptItems = 8,
): ComparableSummary {
  const eligible = eligibleComparables(subject, candidates);
  const medianPpm = median(eligible.map(c => c.pricePerM2));
  const ownPpm = subject.area_m2 && subject.area_m2 > 0 && subject.price > 0
    ? Math.round(subject.price / subject.area_m2)
    : null;
  const pct = (ownPpm != null && medianPpm != null && medianPpm > 0)
    ? Math.round(((ownPpm - medianPpm) / medianPpm) * 100)
    : null;

  return {
    sample: representativeSubsample(eligible, maxPromptItems),
    sample_count: eligible.length,
    median_ppm: medianPpm,
    own_ppm: ownPpm,
    pct_vs_median: pct,
  };
}
