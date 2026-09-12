import { okresFromLocality } from "@/lib/scanner/okresy";

/** Raw comparable row coming from the DB (active listings). */
export interface PriceCompRow {
  property_type: string | null;
  kraj: string | null;
  city: string | null;
  area_m2: number | null;
  price: number | null;
  url: string | null;
}

export type PriceBand = "below" | "avg" | "above";
export type PriceScope = "okres" | "kraj" | "cr";

export interface PriceCompare {
  own_per_m2: number;
  median_per_m2: number;
  diff_pct: number;
  samples: number;
  scope: PriceScope;
  band: PriceBand;
}

interface Comp {
  pt: string;
  kraj: string;
  okres: string;
  area: number;
  ppm2: number;
  url: string;
}

export type PriceCompIndex = Map<string, Comp[]>;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : Math.round(s[mid]);
}

function push(idx: PriceCompIndex, key: string, c: Comp) {
  let b = idx.get(key);
  if (!b) { b = []; idx.set(key, b); }
  b.push(c);
}

/** Build an index of asking Kč/m² comparables, keyed per property type and locality scope. */
export function indexPriceComps(rows: PriceCompRow[]): PriceCompIndex {
  const idx: PriceCompIndex = new Map();
  for (const r of rows) {
    if (!r.property_type || !r.area_m2 || !r.price) continue;
    if (r.area_m2 < 10 || r.area_m2 > 2000) continue;
    const ppm2 = r.price / r.area_m2;
    if (!Number.isFinite(ppm2) || ppm2 < 3000 || ppm2 > 400_000) continue;
    const okres = okresFromLocality(r.city ?? undefined) ?? "";
    const c: Comp = { pt: r.property_type, kraj: r.kraj ?? "", okres, area: r.area_m2, ppm2, url: r.url ?? "" };
    push(idx, `${c.pt}|cr`, c);
    if (c.kraj) push(idx, `${c.pt}|kraj:${c.kraj}`, c);
    if (c.okres) push(idx, `${c.pt}|okres:${c.okres}`, c);
  }
  return idx;
}

const MIN_SAMPLES = 5;

function bandOf(diff: number): PriceBand {
  if (diff < -10) return "below";
  if (diff > 10) return "above";
  return "avg";
}

/** Median asking Kč/m² of comparable listings: same property type (never mixed),
 * area within ±25 %, narrowing from okres → kraj → celá ČR.
 * Houses stop at kraj — a national median mixing Prague with villages is meaningless.
 * The evaluated listing is always excluded from its own sample. */
export function computePriceCompare(args: {
  propertyType: string | null;
  kraj: string | null;
  city: string | null;
  areaM2: number | null;
  price: number | null;
  index: PriceCompIndex;
  selfUrl?: string | null;
}): PriceCompare | null {
  const { propertyType, kraj, areaM2, price, index, selfUrl } = args;
  if (!propertyType || !areaM2 || !price) return null;
  const own = price / areaM2;
  // Sanity: nesmyslné ceny (0 Kč, „cena v RK", nájem omylem) nesrovnáváme.
  if (!Number.isFinite(own) || own < 3000 || own > 400_000) return null;


  const okres = okresFromLocality(args.city ?? undefined);
  const lo = areaM2 * 0.75;
  const hi = areaM2 * 1.25;

  const scopes: Array<{ scope: PriceScope; key: string }> = [];
  if (okres) scopes.push({ scope: "okres", key: `${propertyType}|okres:${okres}` });
  if (kraj) scopes.push({ scope: "kraj", key: `${propertyType}|kraj:${kraj}` });
  if (propertyType !== "domy") scopes.push({ scope: "cr", key: `${propertyType}|cr` });

  for (const s of scopes) {
    const bucket = index.get(s.key);
    if (!bucket) continue;
    const matched = bucket
      .filter(c => c.area >= lo && c.area <= hi && !(selfUrl && c.url === selfUrl))
      .map(c => c.ppm2);
    if (matched.length < MIN_SAMPLES) continue;
    const med = median(matched);
    if (!med) continue;
    const diff = Math.round(((own - med) / med) * 100);
    return {
      own_per_m2: Math.round(own),
      median_per_m2: med,
      diff_pct: diff,
      samples: matched.length,
      scope: s.scope,
      band: bandOf(diff),
    };
  }
  return null;
}

export function priceCompareLabel(pc: PriceCompare): string {
  if (pc.band === "avg") return "v průměru";
  const sign = pc.diff_pct > 0 ? "+" : "−";
  return `${sign}${Math.abs(pc.diff_pct)} % ${pc.diff_pct > 0 ? "nad průměrem" : "pod průměrem"}`;
}

export function priceScopeLabel(scope: PriceScope): string {
  return scope === "okres" ? "okres" : scope === "kraj" ? "kraj" : "celá ČR";
}
