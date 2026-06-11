import type { Investment, PropertyType, Region } from "@/lib/scanner/types";
import type { RentBenchmark } from "@/lib/scanner/rent-benchmark.server";
import { calcYield } from "@/lib/scanner/valuation";

/** A minimal rent comparable used by the hybrid estimator. */
export interface RentComp {
  kraj: string | null;
  property_type: string | null;
  area_m2: number | null;
  price: number; // monthly rent in Kč
}

/** Build an index of active rent listings keyed by `${kraj}|${propertyType}`.
 * Each bucket is sorted by area_m2 ASC for fast ±20% lookup. */
export function indexRentComps(rents: RentComp[]): Map<string, RentComp[]> {
  const idx = new Map<string, RentComp[]>();
  for (const r of rents) {
    if (!r.kraj || !r.property_type || !r.area_m2 || !r.price) continue;
    if (r.price < 2000 || r.price > 200_000) continue;
    const k = `${r.kraj}|${r.property_type}`;
    let bucket = idx.get(k);
    if (!bucket) { bucket = []; idx.set(k, bucket); }
    bucket.push(r);
  }
  for (const bucket of idx.values()) bucket.sort((a, b) => (a.area_m2! - b.area_m2!));
  return idx;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

/** Try to estimate monthly rent from ≥5 comparable active rent listings
 * (same kraj + property_type, area_m2 within ±20%). Returns null if not enough. */
export function estimateRentFromComps(
  kraj: string | null,
  propertyType: string | null,
  areaM2: number | null,
  index: Map<string, RentComp[]>,
): { monthly: number; samples: number } | null {
  if (!kraj || !propertyType || !areaM2) return null;
  const bucket = index.get(`${kraj}|${propertyType}`);
  if (!bucket || bucket.length < 5) return null;
  const lo = areaM2 * 0.8;
  const hi = areaM2 * 1.2;
  const matched = bucket.filter(r => r.area_m2! >= lo && r.area_m2! <= hi).map(r => r.price);
  if (matched.length < 5) return null;
  return { monthly: median(matched), samples: matched.length };
}

/** Compute an `Investment` block for a sale listing using:
 *   1. ≥5 comparable active rent listings (preferred), or
 *   2. the existing rent benchmark in `calcYield` (fallback). */
export function computeHybridYield(args: {
  price: number;
  region: Region;
  propertyType: PropertyType;
  areaM2: number | null;
  name: string;
  locality: string;
  ownership: "osobni" | "druzstevni" | "jine" | undefined;
  kraj: string | null;
  bench: RentBenchmark;
  rentIndex: Map<string, RentComp[]>;
}): Investment | null {
  if (!args.price || args.price < 10000) return null;
  if (!args.areaM2) return null; // hide yield when area is unknown

  // 1) Comparable-rent path
  const comp = estimateRentFromComps(args.kraj, args.propertyType, args.areaM2, args.rentIndex);
  if (comp) {
    let monthly = comp.monthly;
    if (args.ownership === "druzstevni") monthly = Math.round(monthly * 0.92);
    const annual = monthly * 12;
    const gross = (annual / args.price) * 100;
    const net = gross * 0.85;
    const payback = args.price / annual;
    let stars: number; let verdict: string;
    if (net >= 6) { stars = 5; verdict = "Výborná investice 🏆"; }
    else if (net >= 5) { stars = 4; verdict = "Dobrá investice ✅"; }
    else if (net >= 4) { stars = 3; verdict = "Průměrný výnos ⚖️"; }
    else if (net >= 3) { stars = 2; verdict = "Podprůměrné ⚠️"; }
    else { stars = 1; verdict = "Nevýhodné ❌"; }
    return {
      monthly_rent: monthly,
      annual_rent: annual,
      gross_yield: Math.round(gross * 100) / 100,
      net_yield: Math.round(net * 100) / 100,
      payback_years: Math.round(payback * 10) / 10,
      stars,
      verdict,
      rent_per_m2: Math.round(monthly / args.areaM2),
      rent_basis_label: `Medián ${comp.samples} srovnatelných pronájmů (kraj + typ + plocha ±20 %)`,
      rent_source: "okres_live",
    };
  }

  // 2) Benchmark fallback
  return calcYield(
    args.price, args.region, args.propertyType, args.areaM2,
    args.name, args.locality, args.ownership, args.bench,
  );
}
