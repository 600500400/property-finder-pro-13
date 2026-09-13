import { okresFromLocality } from "@/lib/scanner/okresy";
import type { PriceBand } from "./price-compare";

export type MunicipalityBand = "do1999" | "2000_9999" | "10000_49999" | "50000_plus";
export type CsuScope = "okres_band" | "okres" | "kraj_band" | "kraj" | "praha";

// Our floor area (užitná plocha) is roughly twice the ČSÚ average (obytná plocha,
// median 84 m² per okres), so a single global ratio mixes an area-definition
// mismatch with a genuine size effect. Everything is therefore calibrated inside
// a size band, and a listing is only ever compared within its own band.
export type SizeBand = "lt100" | "100_150" | "150_250" | "gt250";

export const SIZE_BANDS: SizeBand[] = ["lt100", "100_150", "150_250", "gt250"];

export function sizeBandOf(areaM2: number): SizeBand {
  if (areaM2 < 100) return "lt100";
  if (areaM2 < 150) return "100_150";
  if (areaM2 < 250) return "150_250";
  return "gt250";
}

export const SIZE_BAND_LABEL: Record<SizeBand, string> = {
  lt100: "do 100 m²",
  "100_150": "100–150 m²",
  "150_250": "150–250 m²",
  gt250: "nad 250 m²",
};

export interface BandCalibration {
  size_band: SizeBand;
  median_ratio: number;
  factor: number;
  typical_area_m2: number | null;
  sample_count: number;
}

// Coarse verdict instead of a precise percentage: the level rests on an estimated
// užitná→obytná conversion, so a figure like "−18 %" would imply precision we
// do not have. Flats keep their percentage — that comparison is like-for-like.
export type CsuVerdict = "much_cheaper" | "cheaper" | "average" | "pricier" | "much_pricier";

export const CSU_VERDICT_LABEL: Record<CsuVerdict, string> = {
  much_cheaper: "Výrazně levnější",
  cheaper: "Levnější",
  average: "V průměru",
  pricier: "Dražší",
  much_pricier: "Výrazně dražší",
};

export const OWN_UNIT_LABEL = "Kč/m² užitné plochy";
export const CSU_UNIT_LABEL = "Kč/m² obytné plochy (ČSÚ)";

export interface CsuOkresRow {
  kraj: string;
  okres: string | null;
  level: string;
  avg_size_m2: number | null;
  price_2025: number | null;
  band: string | null;
  band_price_uplifted: number | null;
  /** ČSÚ footnote "malý počet údajů k dispozici" on this band cell. */
  low_sample?: boolean | null;
}

export interface CsuKrajRow {
  kraj: string;
  band: string | null;
  price_2025: number | null;
  avg_size_m2: number | null;
}

export interface PopulationRow {
  kraj: string;
  name: string;
  name_norm: string;
  population: number;
  is_ambiguous_in_kraj: boolean;
}

export interface CsuHouseCompare {
  own_per_m2: number;
  benchmark_per_m2: number;
  /** Benchmark after the size-band calibration factor; what own_per_m2 is judged against. */
  expected_per_m2: number;
  verdict: CsuVerdict;
  verdict_label: string;
  band: PriceBand;
  scope: CsuScope;
  scope_label: string;
  size_band: SizeBand;
  size_band_label: string;
  band_factor?: number;
  band_sample_count?: number;
  band_typical_area_m2?: number;
  municipality_band?: MunicipalityBand;
  municipality_match: "matched" | "ambiguous" | "unmatched";
  avg_house_size_m2?: number;
  area_warning: boolean;
  /** Bazoš publishes no structured area field at all — flag it in the UI. */
  area_low_confidence: boolean;
  area_type?: string;
}

export interface CsuIndexes {
  okres: Map<string, CsuOkresRow>;
  kraj: Map<string, CsuKrajRow>;
  population: Map<string, PopulationRow[]>;
  calibration?: Map<SizeBand, BandCalibration>;
}

export function normalizeCzechName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function municipalityBand(population: number): MunicipalityBand {
  if (population < 2000) return "do1999";
  if (population < 10000) return "2000_9999";
  if (population < 50000) return "10000_49999";
  return "50000_plus";
}

const PARENT_CITIES = ["praha", "brno", "ostrava", "plzen", "usti-nad-labem", "liberec", "olomouc", "pardubice"];

export function municipalityFromLocality(locality: string): string {
  const first = locality.split(/[,;]/, 1)[0]?.trim() ?? "";
  const normalized = normalizeCzechName(first);
  for (const city of PARENT_CITIES) {
    if (normalized === city || normalized.startsWith(`${city}-`)) return city;
  }
  const beforeDash = first.split(/\s+[–—-]\s+/, 1)[0]?.trim() ?? first;
  return normalizeCzechName(beforeDash);
}

export function buildCsuIndexes(
  okresRows: CsuOkresRow[],
  krajRows: CsuKrajRow[],
  populationRows: PopulationRow[],
  calibrationRows: BandCalibration[] = [],
): CsuIndexes {
  const okres = new Map<string, CsuOkresRow>();
  for (const row of okresRows) okres.set(`${row.level}|${row.kraj}|${row.okres ?? ""}|${row.band ?? ""}`, row);
  const kraj = new Map<string, CsuKrajRow>();
  for (const row of krajRows) kraj.set(`${row.kraj}|${row.band ?? ""}`, row);
  const population = new Map<string, PopulationRow[]>();
  for (const row of populationRows) {
    const key = `${row.kraj}|${row.name_norm}`;
    const values = population.get(key) ?? [];
    values.push(row);
    population.set(key, values);
  }
  const calibration = new Map<SizeBand, BandCalibration>();
  for (const row of calibrationRows) calibration.set(row.size_band, row);
  return { okres, kraj, population, calibration: calibration.size ? calibration : undefined };
}

// A handful of ČSÚ band rows carry a corrupt value — a per-dwelling price where a
// per-m² price belongs (e.g. okres Písek: 617 806 "Kč/m²"). Reject any band price
// more than 3x off the okres/kraj per-m² price and fall back to that instead.
function plausibleBandPrice(bandPrice: number, reference: number | null): boolean {
  if (!reference) return bandPrice > 3_000 && bandPrice < 400_000;
  return bandPrice >= reference / 3 && bandPrice <= reference * 3;
}

function priceBand(diff: number): PriceBand {
  if (diff < -10) return "below";
  if (diff > 10) return "above";
  return "avg";
}

function verdictOf(diff: number): CsuVerdict {
  if (diff <= -25) return "much_cheaper";
  if (diff <= -10) return "cheaper";
  if (diff < 10) return "average";
  if (diff < 25) return "pricier";
  return "much_pricier";
}

/**
 * The area warning now measures deviation from the TYPICAL SIZE OF THE LISTING'S
 * OWN BAND, not from the ČSÚ average of ~85 m² — the old threshold fired on 69 %
 * of houses purely because the two sides measure different areas.
 */
const AREA_WARNING_TOLERANCE = 0.6;

export function computeCsuHouseCompare(args: {
  kraj: string | null;
  locality: string | null;
  areaM2: number | null;
  price: number | null;
  indexes: CsuIndexes;
  source?: string | null;
  areaType?: string | null;
}): CsuHouseCompare | null {
  const { kraj, locality, areaM2, price, indexes } = args;
  if (!kraj || !locality || !areaM2 || !price) return null;
  const own = price / areaM2;
  if (!Number.isFinite(own) || own < 3000 || own > 400_000) return null;

  const municipality = municipalityFromLocality(locality);
  const populationMatches = indexes.population.get(`${kraj}|${municipality}`) ?? [];
  const ambiguous = populationMatches.length > 1 || populationMatches.some(row => row.is_ambiguous_in_kraj);
  const matched = populationMatches.length === 1 && !ambiguous;
  const sizeBand = matched ? municipalityBand(populationMatches[0].population) : undefined;
  const okres = okresFromLocality(locality);

  let benchmark: number | null = null;
  let avgSize: number | null = null;
  let scope: CsuScope | null = null;

  if (kraj === "praha") {
    const row = indexes.okres.get("okres|praha|praha|50000_plus");
    benchmark = row?.band_price_uplifted ?? row?.price_2025 ?? null;
    avgSize = row?.avg_size_m2 ?? null;
    scope = benchmark ? "praha" : null;
  } else if (okres) {
    const total = indexes.okres.get(`okres|${kraj}|${okres}|do1999`);
    const bandRow = sizeBand ? indexes.okres.get(`okres|${kraj}|${okres}|${sizeBand}`) : undefined;
    if (bandRow?.band_price_uplifted && plausibleBandPrice(bandRow.band_price_uplifted, total?.price_2025 ?? null)) {
      benchmark = bandRow.band_price_uplifted;
      scope = "okres_band";
    } else if (total?.price_2025) {
      benchmark = total.price_2025;
      scope = "okres";
    }
    avgSize = bandRow?.avg_size_m2 ?? total?.avg_size_m2 ?? null;
  } else {
    const bandRow = sizeBand ? indexes.kraj.get(`${kraj}|${sizeBand}`) : undefined;
    const total = indexes.kraj.get(`${kraj}|`);
    if (bandRow?.price_2025 && plausibleBandPrice(bandRow.price_2025, total?.price_2025 ?? null)) {
      benchmark = bandRow.price_2025;
      scope = "kraj_band";
    } else if (total?.price_2025) {
      benchmark = total.price_2025;
      scope = "kraj";
    }
    avgSize = bandRow?.avg_size_m2 ?? total?.avg_size_m2 ?? null;
  }

  if (!benchmark || !scope) return null;

  const sb = sizeBandOf(areaM2);
  const cal = indexes.calibration?.get(sb);
  // factor converts a ČSÚ obytná-plocha price into the level our užitná-plocha
  // prices sit at for houses of this size; without calibration we fall back to 1
  // and the comparison stays raw.
  const factor = cal?.factor && cal.factor > 0 ? cal.factor : 1;
  const expected = Math.round(benchmark / factor);
  const diff = Math.round(((own - expected) / expected) * 100);

  const typical = cal?.typical_area_m2 ?? null;
  const areaWarning = !!typical && (
    areaM2 < typical * (1 - AREA_WARNING_TOLERANCE) || areaM2 > typical * (1 + AREA_WARNING_TOLERANCE)
  );

  const labels: Record<CsuScope, string> = {
    okres_band: "ČSÚ · okres a velikost obce",
    okres: ambiguous ? "ČSÚ · okres (obec nejednoznačná)" : "ČSÚ · okres",
    kraj_band: "ČSÚ · kraj a velikost obce",
    kraj: "ČSÚ · kraj",
    praha: "ČSÚ · Praha",
  };
  const verdict = verdictOf(diff);
  return {
    own_per_m2: Math.round(own),
    benchmark_per_m2: benchmark,
    expected_per_m2: expected,
    verdict,
    verdict_label: CSU_VERDICT_LABEL[verdict],
    band: priceBand(diff),
    scope,
    scope_label: labels[scope],
    size_band: sb,
    size_band_label: SIZE_BAND_LABEL[sb],
    band_factor: cal?.factor,
    band_sample_count: cal?.sample_count,
    band_typical_area_m2: typical ?? undefined,
    municipality_band: sizeBand,
    municipality_match: ambiguous ? "ambiguous" : matched ? "matched" : "unmatched",
    avg_house_size_m2: avgSize ?? undefined,
    area_warning: areaWarning,
    benchmark_low_sample: benchmarkLowSample,
    area_low_confidence: args.source === "bazos" || args.areaType === "zastavena",
    area_type: args.areaType ?? undefined,
  };
}
