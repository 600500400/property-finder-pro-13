import { okresFromLocality } from "@/lib/scanner/okresy";
import type { PriceBand } from "./price-compare";

export type MunicipalityBand = "do1999" | "2000_9999" | "10000_49999" | "50000_plus";
export type CsuScope = "okres_band" | "okres" | "kraj_band" | "kraj" | "praha";

export interface CsuOkresRow {
  kraj: string;
  okres: string | null;
  level: string;
  avg_size_m2: number | null;
  price_2025: number | null;
  band: string | null;
  band_price_uplifted: number | null;
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
  diff_pct: number;
  band: PriceBand;
  scope: CsuScope;
  scope_label: string;
  municipality_band?: MunicipalityBand;
  municipality_match: "matched" | "ambiguous" | "unmatched";
  avg_house_size_m2?: number;
  area_warning: boolean;
  asking_premium_pct?: number;
}

export interface CsuIndexes {
  okres: Map<string, CsuOkresRow>;
  kraj: Map<string, CsuKrajRow>;
  population: Map<string, PopulationRow[]>;
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

export function buildCsuIndexes(okresRows: CsuOkresRow[], krajRows: CsuKrajRow[], populationRows: PopulationRow[]): CsuIndexes {
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
  return { okres, kraj, population };
}

function priceBand(diff: number): PriceBand {
  if (diff < -10) return "below";
  if (diff > 10) return "above";
  return "avg";
}

export function computeCsuHouseCompare(args: {
  kraj: string | null;
  locality: string | null;
  areaM2: number | null;
  price: number | null;
  indexes: CsuIndexes;
  askingPremiumPct?: number;
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
    if (bandRow?.band_price_uplifted) {
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
    if (bandRow?.price_2025) {
      benchmark = bandRow.price_2025;
      scope = "kraj_band";
    } else if (total?.price_2025) {
      benchmark = total.price_2025;
      scope = "kraj";
    }
    avgSize = bandRow?.avg_size_m2 ?? total?.avg_size_m2 ?? null;
  }

  if (!benchmark || !scope) return null;
  const diff = Math.round(((own - benchmark) / benchmark) * 100);
  const areaWarning = !!avgSize && (areaM2 < avgSize * 0.5 || areaM2 > avgSize * 1.5);
  const labels: Record<CsuScope, string> = {
    okres_band: "ČSÚ · okres a velikost obce",
    okres: ambiguous ? "ČSÚ · okres (obec nejednoznačná)" : "ČSÚ · okres",
    kraj_band: "ČSÚ · kraj a velikost obce",
    kraj: "ČSÚ · kraj",
    praha: "ČSÚ · Praha",
  };
  return {
    own_per_m2: Math.round(own), benchmark_per_m2: benchmark, diff_pct: diff,
    band: priceBand(diff), scope, scope_label: labels[scope],
    municipality_band: sizeBand,
    municipality_match: ambiguous ? "ambiguous" : matched ? "matched" : "unmatched",
    avg_house_size_m2: avgSize ?? undefined, area_warning: areaWarning,
    asking_premium_pct: args.askingPremiumPct,
  };
}