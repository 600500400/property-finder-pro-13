import type { Listing, Ownership, OwnershipConfidence, ScanFilters } from "./types";
import { detectAnuity } from "./anuity";
import { fallbackOwnership, parseOwnership } from "./valuation";

export interface OwnershipResolution {
  ownership: Ownership;
  ownership_confidence: OwnershipConfidence;
  anuity: ReturnType<typeof detectAnuity> | undefined;
  priceForYield: number;
}

/**
 * Jediná zdrojová pravda pro vyhodnocení vlastnictví + anuity z listingu.
 * Volají ji jak runtime (scan.functions, scan-internal.server), tak regresní testy.
 */
export function resolveOwnership(
  listing: Pick<Listing, "name" | "locality" | "description_snippet" | "price" | "ownership">,
  filters: Pick<ScanFilters, "deal_type" | "property_type">,
): OwnershipResolution {
  const combinedText = `${listing.name} ${listing.locality} ${listing.description_snippet || ""}`;
  const detected = listing.ownership ?? parseOwnership(combinedText);
  const ownership = detected ?? fallbackOwnership(filters.deal_type, filters.property_type);
  const ownership_confidence: OwnershipConfidence = detected ? "high" : "low";
  const anuityText = `${listing.name} ${listing.description_snippet || ""}`;
  const anuity = detectAnuity(anuityText, listing.price, ownership);
  const priceForYield = anuity.effective_price ?? listing.price;
  return {
    ownership,
    ownership_confidence,
    anuity: anuity.has_anuity ? anuity : undefined,
    priceForYield,
  };
}
