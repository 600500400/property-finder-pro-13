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

export type Ownership = "osobni" | "druzstevni" | "statni" | "jine";

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
}

export interface Investment {
  monthly_rent: number;
  annual_rent: number;
  gross_yield: number;
  net_yield: number;
  payback_years: number;
  stars: number;
  verdict: string;
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
}

export interface ScanResult {
  count: number;
  results: Listing[];
  diagnostics: Diagnostic[];
  ts: string;
}
