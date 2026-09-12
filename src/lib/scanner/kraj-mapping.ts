import { okresFromLocality, OKRES_BY_SLUG } from "./okresy";

const REGION_NAME_TO_SLUG: Array<[RegExp, string]> = [
  [/\bhlavni mesto praha\b/, "praha"],
  [/\bstredocesky kraj\b/, "stredocesky"],
  [/\bjihocesky kraj\b/, "jihocesky"],
  [/\bplzensky kraj\b/, "plzensky"],
  [/\bkarlovarsky kraj\b/, "karlovarsky"],
  [/\bustecky kraj\b/, "ustecky"],
  [/\bliberecky kraj\b/, "liberecky"],
  [/\bkralovehradecky kraj\b/, "kralovehradecky"],
  [/\bpardubicky kraj\b/, "pardubicky"],
  [/\b(?:kraj vysocina|vysocina kraj)\b/, "vysocina"],
  [/\bjihomoravsky kraj\b/, "jihomoravsky"],
  [/\bolomoucky kraj\b/, "olomoucky"],
  [/\bzlinsky kraj\b/, "zlinsky"],
  [/\bmoravskoslezsky kraj\b/, "moravskoslezsky"],
];

function normalizeLocality(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Map a free-text locality (city / district name) to a `kraj` slug.
 * Returns null when no okres matches — caller keeps `kraj = null` and the row
 * is still findable via the "Celá ČR" filter. */
export function regionFromLocality(locality: string | null | undefined): string | null {
  if (!locality) return null;
  const normalized = normalizeLocality(locality);
  const explicitRegion = REGION_NAME_TO_SLUG.find(([pattern]) => pattern.test(normalized));
  if (explicitRegion) return explicitRegion[1];
  const okres = okresFromLocality(locality);
  if (!okres) return null;
  return OKRES_BY_SLUG[okres]?.region ?? null;
}

/** Sanity-clamp area_m2: keep 10–2000, otherwise null. */
export function sanitizeAreaM2(area: number | null | undefined): number | null {
  if (area == null || !Number.isFinite(area)) return null;
  if (area < 10 || area > 2000) return null;
  return Math.round(area);
}

/** Derive price_per_m2 only when both price and (sanitized) area are sensible. */
export function derivePricePerM2(price: number | null | undefined, areaM2: number | null): number | null {
  if (!price || price < 10000) return null;
  if (!areaM2) return null;
  return Math.round(price / areaM2);
}
