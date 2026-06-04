export type DealType = "prodej" | "pronajem";
export type PropertyType = "ostatni" | "byty" | "domy" | "pozemky" | "komercni";
export type SubType = "garaz" | "garazove_stani" | "";
export type Region =
  | ""
  | "praha"
  | "stredocesky"
  | "jihocesky"
  | "jihomoravsky"
  | "karlovarsky"
  | "kralovehradecky"
  | "liberecky"
  | "moravskoslezsky"
  | "olomoucky"
  | "pardubicky"
  | "plzensky"
  | "ustecky"
  | "vysocina"
  | "zlinsky";

export type SourceKey =
  | "sreality"
  | "bazos"
  | "bezrealitky"
  | "hyperinzerce"
  | "realitymix"
  | "annonce"
  | "idnes";

export type SortBy = "source" | "price_asc" | "price_desc" | "yield" | "date_desc";

export type Ownership = "osobni" | "druzstevni" | "jine";
export type OwnershipConfidence = "high" | "low";

export interface AnuityInfo {
  has_anuity: boolean;
  amount?: number;          // detekovaná částka anuity v Kč
  effective_price?: number; // price + amount, pokud obojí známe
  confidence: "high" | "medium" | "low";
  source_phrase?: string;   // krátký výňatek textu pro tooltip
}

export type PublishedDateSource = "api" | "html" | "estimated" | "fallback_now";
export type RentBasisSource = "district" | "okres_live" | "okres_static" | "region" | "fallback";

export interface ScanFilters {
  deal_type: DealType;
  property_type: PropertyType;
  sub_type: SubType;
  region: Region;
  price_min?: number;
  price_max?: number;
  sources: SourceKey[];
  sort_by: SortBy;
  per_source_limit: number;
  ownership?: Ownership[]; // klientský filtr; prázdné/undefined = vše
}


export interface Investment {
  monthly_rent: number;
  annual_rent: number;
  gross_yield: number;
  net_yield: number;
  payback_years: number;
  stars: number;
  verdict: string;
  rent_per_m2?: number;
  rent_basis_label?: string; // např. "Praha 9: 360 Kč/m²"
  rent_source?: RentBasisSource;
}

export interface Listing {
  source: string;
  source_key: SourceKey;
  name: string;
  locality: string;
  price: number;
  price_text: string;
  url: string;
  img: string;
  area: string;
  area_m2?: number;
  published_at?: string; // ISO date
  published_at_source?: PublishedDateSource;
  ownership?: Ownership;
  invest: Investment | null;
  badges?: string[];
}

export interface Diagnostic {
  source: string;
  key: SourceKey;
  count: number;
  ms: number;
  ok: boolean;
  error: string | null;
  dates_from?: { api: number; html: number; fallback: number };
}

export interface ScanMeta {
  benchmark_fetched_at?: string;
  benchmark_source?: string;
  benchmark_live_okresy?: number;
  benchmark_static_okresy?: number;
  filtered_foreign?: number;
  filtered_reasons?: Record<string, number>;
}


export interface ScanResult {
  count: number;
  results: Listing[];
  diagnostics: Diagnostic[];
  ts: string;
  meta?: ScanMeta;
}
