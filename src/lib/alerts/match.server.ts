import type { ScanFilters, SourceKey, DealType, PropertyType, Region } from "@/lib/scanner/types";
import type { RentBenchmark } from "@/lib/scanner/rent-benchmark.server";
import { computeHybridYield, type RentComp } from "@/lib/listings/yield.server";

/** Subset of fields we need from a DB listing row to match against a saved search. */
export interface MatchListing {
  source: SourceKey | string;
  title: string | null;
  price: number | null;
  deal_type: string | null;
  property_type: string | null;
  kraj: string | null;
  city: string | null;
  area_m2: number | null;
  ownership: string | null;
  url: string;
  image_url: string | null;
}

export interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  min_yield: number | null;
  frequency: "instant" | "daily";
  is_active: boolean;
}

/** Best-effort coercion of stored filter JSON to ScanFilters shape. */
export function asFilters(json: Record<string, unknown>): Partial<ScanFilters> {
  return json as unknown as Partial<ScanFilters>;
}

export interface MatchContext {
  bench: RentBenchmark;
  rentIndex: Map<string, RentComp[]>;
}

/** Returns true when the listing satisfies the saved search's filters and min_yield. */
export function matchesSearch(
  listing: MatchListing,
  search: SavedSearchRow,
  ctx?: MatchContext,
): boolean {
  if (!search.is_active) return false;
  const f = asFilters(search.filters);

  if (f.deal_type && listing.deal_type && f.deal_type !== listing.deal_type) return false;
  if (f.property_type && listing.property_type && f.property_type !== listing.property_type) return false;
  const regions = Array.isArray(f.regions) ? f.regions.filter(Boolean) : [];
  if (regions.length > 0) {
    if (listing.kraj && !regions.includes(listing.kraj as typeof regions[number])) return false;
  } else if (f.region && listing.kraj && f.region !== listing.kraj) return false;
  const land = (listing as { land_area_m2?: number | null }).land_area_m2 ?? null;
  if (f.land_area_min != null && (land == null || land < f.land_area_min)) return false;
  if (f.land_area_max != null && (land == null || land > f.land_area_max)) return false;
  if (Array.isArray(f.sources) && f.sources.length > 0 && !f.sources.includes(listing.source as SourceKey)) return false;
  if (f.price_min != null && (listing.price ?? 0) < f.price_min) return false;
  if (f.price_max != null && (listing.price ?? 0) > f.price_max) return false;

  if (search.min_yield != null && ctx) {
    // Yield only meaningful for sale listings with known area.
    if (listing.deal_type !== "prodej" || !listing.area_m2 || !listing.price) return false;
    const inv = computeHybridYield({
      price: listing.price,
      region: (listing.kraj ?? "") as Region,
      propertyType: (listing.property_type ?? "byty") as PropertyType,
      areaM2: listing.area_m2,
      name: listing.title ?? "",
      locality: listing.city ?? "",
      ownership: (listing.ownership ?? undefined) as "osobni" | "druzstevni" | "jine" | undefined,
      kraj: listing.kraj,
      bench: ctx.bench,
      rentIndex: ctx.rentIndex,
    });
    if (!inv || inv.net_yield < search.min_yield) return false;
  }
  return true;
}

/** Convenience: returns true if any of the searches matches. */
export function anyMatches(listing: MatchListing, searches: SavedSearchRow[], ctx?: MatchContext): boolean {
  return searches.some((s) => matchesSearch(listing, s, ctx));
}

// Re-export DealType / PropertyType so test files have one stable import.
export type { DealType, PropertyType };
