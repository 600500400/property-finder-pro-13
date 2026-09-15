/**
 * Authoritative listing facts used for AI analysis + shared (impersonal) cache key.
 *
 * The cache namespace is versioned: older `ai_analyses` rows (which could contain
 * personalised content) can never be matched again, without deleting anything.
 */

export interface FactFlag {
  code: string;
  category: string;
  label: string;
  snippet?: string;
}

export interface ListingFacts {
  id: string;
  source: string;
  title: string;
  city: string | null;
  kraj: string | null;
  property_type: string | null;
  deal_type: string | null;
  house_subtype: string | null;
  price: number;
  area_m2: number | null;
  land_area_m2: number | null;
  ownership: string | null;
  url: string;
  description_snippet: string | null;
  flags: FactFlag[];
}

/** Bump when the prompt or the impersonal payload shape changes. */
export const CACHE_NAMESPACE = "v2-impersonal";

/** Deterministic fingerprint of the authoritative listing facts (no user data). */
export function factsFingerprint(f: ListingFacts): string {
  return JSON.stringify({
    id: f.id,
    price: f.price,
    area: f.area_m2,
    land: f.land_area_m2,
    kraj: f.kraj,
    city: f.city,
    pt: f.property_type,
    dt: f.deal_type,
    sub: f.house_subtype,
    own: f.ownership,
    title: f.title,
    snippet: f.description_snippet ?? "",
    flags: f.flags.map(x => x.code).sort(),
  });
}

export async function factsCacheKey(f: ListingFacts): Promise<string> {
  const input = `${CACHE_NAMESPACE}|${factsFingerprint(f)}`;
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
