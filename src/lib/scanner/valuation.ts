import type { DealType, Investment, Ownership, PropertyType, Region, RentBasisSource } from "./types";
import type { RentBenchmark } from "./rent-benchmark.server";
import { okresFromLocality, OKRES_BY_SLUG } from "./okresy";

// Re-export pro back-compat
export type { RentBenchmark };

// Krajská hodnota nájmu (Kč/m²/měsíc) — používá se jen pro garáže.
const RENT_PER_M2_REGION: Record<string, number> = {
  praha: 415,

  stredocesky: 290,
  jihocesky: 260,
  jihomoravsky: 330,
  karlovarsky: 205,
  kralovehradecky: 240,
  liberecky: 245,
  moravskoslezsky: 230,
  olomoucky: 235,
  pardubicky: 235,
  plzensky: 280,
  ustecky: 195,
  vysocina: 215,
  zlinsky: 225,
  "": 270,
};

// Čtvrť / městská část → Kč/m²/měsíc. Slug normalizovaný (lowercase, bez diakritiky, "-" oddělovač).
// Zdroj: Deloitte Rent Index 2024 + Sreality benchmark 2024/2025.
const RENT_PER_M2_DISTRICT: Record<string, number> = {
  // Praha 1–22
  "praha-1": 510,
  "praha-2": 470,
  "praha-3": 430,
  "praha-4": 380,
  "praha-5": 400,
  "praha-6": 420,
  "praha-7": 425,
  "praha-8": 380,
  "praha-9": 360,
  "praha-10": 350,
  "praha-11": 340,
  "praha-12": 335,
  "praha-13": 345,
  "praha-14": 320,
  "praha-15": 320,
  "praha-16": 310,
  "praha-17": 320,
  "praha-18": 330,
  "praha-19": 320,
  "praha-20": 305,
  "praha-21": 305,
  "praha-22": 305,
  // Brno
  "brno-stred": 380,
  "brno-mesto": 360,
  "brno-sever": 340,
  "brno-jih": 320,
  "brno-vychod": 310,
  "brno-zapad": 320,
  // Plzeň
  "plzen-1": 295,
  "plzen-2": 280,
  "plzen-3": 285,
  "plzen-4": 270,
  // Ostrava
  "ostrava-poruba": 245,
  "ostrava-jih": 230,
  "ostrava-mesto": 240,
  // Krajská města
  "ceske-budejovice": 285,
  "hradec-kralove": 270,
  "liberec": 275,
  "olomouc": 270,
  "pardubice": 260,
  "usti-nad-labem": 220,
  "zlin": 250,
  "jihlava": 230,
  "karlovy-vary": 230,
};

// Fixní měsíční nájem pro garáže / stání
const REGION_RENT_GARAGE: Record<string, number> = {
  "": 2200, praha: 3500, stredocesky: 2200, jihocesky: 1600, jihomoravsky: 2400,
  karlovarsky: 1500, kralovehradecky: 1700, liberecky: 1600, moravskoslezsky: 1800,
  olomoucky: 1700, pardubicky: 1600, plzensky: 2000, ustecky: 1500, vysocina: 1500, zlinsky: 1700,
};

const FALLBACK_AREA: Record<string, number> = {
  byty: 55, domy: 130, komercni: 80, pozemky: 0, ostatni: 0,
};

const DISTRICT_LABEL: Record<string, string> = {
  "praha-1": "Praha 1", "praha-2": "Praha 2", "praha-3": "Praha 3", "praha-4": "Praha 4",
  "praha-5": "Praha 5", "praha-6": "Praha 6", "praha-7": "Praha 7", "praha-8": "Praha 8",
  "praha-9": "Praha 9", "praha-10": "Praha 10", "praha-11": "Praha 11", "praha-12": "Praha 12",
  "praha-13": "Praha 13", "praha-14": "Praha 14", "praha-15": "Praha 15", "praha-16": "Praha 16",
  "praha-17": "Praha 17", "praha-18": "Praha 18", "praha-19": "Praha 19", "praha-20": "Praha 20",
  "praha-21": "Praha 21", "praha-22": "Praha 22",
  "brno-stred": "Brno-střed", "brno-mesto": "Brno-město", "brno-sever": "Brno-sever",
  "brno-jih": "Brno-jih", "brno-vychod": "Brno-východ", "brno-zapad": "Brno-západ",
  "plzen-1": "Plzeň 1", "plzen-2": "Plzeň 2", "plzen-3": "Plzeň 3", "plzen-4": "Plzeň 4",
  "ostrava-poruba": "Ostrava-Poruba", "ostrava-jih": "Ostrava-jih", "ostrava-mesto": "Ostrava-město",
  "ceske-budejovice": "České Budějovice", "hradec-kralove": "Hradec Králové",
  "liberec": "Liberec", "olomouc": "Olomouc", "pardubice": "Pardubice",
  "usti-nad-labem": "Ústí nad Labem", "zlin": "Zlín", "jihlava": "Jihlava", "karlovy-vary": "Karlovy Vary",
};

const REGION_LABEL: Record<string, string> = {
  praha: "Praha", stredocesky: "Středočeský kraj", jihocesky: "Jihočeský kraj",
  jihomoravsky: "Jihomoravský kraj", karlovarsky: "Karlovarský kraj",
  kralovehradecky: "Královéhradecký kraj", liberecky: "Liberecký kraj",
  moravskoslezsky: "Moravskoslezský kraj", olomoucky: "Olomoucký kraj",
  pardubicky: "Pardubický kraj", plzensky: "Plzeňský kraj", ustecky: "Ústecký kraj",
  vysocina: "Vysočina", zlinsky: "Zlínský kraj", "": "ČR (průměr)",
};

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Z lokality "Praha 9 - Vysočany" / "Brno - střed" / "Plzeň 3" → slug
function districtSlugFromLocality(locality: string | undefined, region: Region): string | null {
  if (!locality) return null;
  const norm = deaccent(locality.toLowerCase());

  // Praha N
  const mPraha = norm.match(/praha\s*[-\s]*(\d{1,2})\b/);
  if (mPraha) return `praha-${mPraha[1]}`;

  // Plzeň N
  const mPlzen = norm.match(/plzen\s*[-\s]*(\d)\b/);
  if (mPlzen) return `plzen-${mPlzen[1]}`;

  // Brno-část
  const mBrno = norm.match(/brno\s*[-\s]+(stred|mesto|sever|jih|vychod|zapad)/);
  if (mBrno) return `brno-${mBrno[1]}`;

  // Ostrava-část
  if (norm.includes("ostrava")) {
    if (norm.includes("poruba")) return "ostrava-poruba";
    if (norm.includes("jih")) return "ostrava-jih";
    return "ostrava-mesto";
  }

  // Krajská města jako city-level
  const cities = ["ceske-budejovice", "hradec-kralove", "liberec", "olomouc", "pardubice", "usti-nad-labem", "zlin", "jihlava", "karlovy-vary"];
  for (const c of cities) {
    if (norm.includes(c.replace(/-/g, " ")) || norm.includes(c.replace(/-/g, ""))) return c;
  }

  // Sám "Praha" bez čísla → ne district
  void region;
  return null;
}

// (RentBenchmark interface lives in rent-benchmark.server.ts — re-exported above)

function dispositionFactor(name: string): number {
  const n = name.toLowerCase();
  if (/(1\+kk|1\+1|garsoni)/.test(n)) return 1.15;
  if (/(2\+kk|2\+1)/.test(n)) return 1.05;
  if (/(3\+kk|3\+1)/.test(n)) return 1.0;
  if (/(4\+kk|4\+1)/.test(n)) return 0.95;
  if (/(5\+kk|5\+1|6\+)/.test(n)) return 0.9;
  return 1.0;
}

interface RentResult {
  monthly: number | null;
  perM2: number | null;
  basisLabel: string;
  source: RentBasisSource;
}

function rentMonthly(
  region: Region,
  propertyType: PropertyType,
  areaM2: number | undefined,
  name: string,
  locality: string,
  bench: RentBenchmark,
): RentResult {
  if (propertyType === "ostatni") {
    const m = REGION_RENT_GARAGE[region] ?? REGION_RENT_GARAGE[""];
    return { monthly: m, perM2: null, basisLabel: `${REGION_LABEL[region] || "ČR"}: garáž`, source: "region" };
  }
  if (propertyType === "pozemky") {
    return { monthly: null, perM2: null, basisLabel: "—", source: "fallback" };
  }

  const districtSlug = districtSlugFromLocality(locality, region);
  const okresSlug = okresFromLocality(locality);

  let perM2Base: number;
  let basisLabel: string;
  let source: RentBasisSource;

  // 1) Pražské obvody / Brno-části / Plzeň-N / Ostrava-části — nejpřesnější city-level
  if (districtSlug && bench.district[districtSlug] != null) {
    perM2Base = bench.district[districtSlug];
    basisLabel = `${DISTRICT_LABEL[districtSlug] || districtSlug}: ${perM2Base} Kč/m²`;
    source = "district";
  }
  // 2) Okres (77 okresů) — preferujeme živý medián ze Sreality
  else if (okresSlug && bench.okres[okresSlug]) {
    const stat = bench.okres[okresSlug];
    perM2Base = stat.perM2;
    const info = OKRES_BY_SLUG[okresSlug];
    const label = info?.label ?? okresSlug;
    basisLabel = stat.source === "live"
      ? `Okres ${label}: ${Math.round(stat.perM2)} Kč/m² (medián z ${stat.samples} inz., Sreality)`
      : `Okres ${label}: ${Math.round(stat.perM2)} Kč/m² (statický odhad)`;
    source = stat.source === "live" ? "okres_live" : "okres_static";
  }
  // 3) Kraj
  else if (region && bench.region[region] != null) {
    perM2Base = bench.region[region];
    basisLabel = `${REGION_LABEL[region]}: ${perM2Base} Kč/m²`;
    source = "region";
  }
  // 4) ČR průměr
  else {
    perM2Base = bench.region[""] ?? 270;
    basisLabel = `ČR (průměr): ${perM2Base} Kč/m²`;
    source = "fallback";
  }

  const typeMult = propertyType === "domy" ? 0.8 : propertyType === "komercni" ? 0.9 : 1.0;
  const dispMult = propertyType === "byty" ? dispositionFactor(name) : 1.0;
  const perM2 = perM2Base * typeMult * dispMult;
  const area = areaM2 && areaM2 > 5 ? areaM2 : FALLBACK_AREA[propertyType];
  if (!area) return { monthly: null, perM2, basisLabel, source };
  return { monthly: Math.round(perM2 * area), perM2: Math.round(perM2), basisLabel, source };
}


export function calcYield(
  price: number,
  region: Region,
  propertyType: PropertyType,
  areaM2: number | undefined,
  name: string,
  locality: string,
  ownership: Ownership | undefined,
  bench: RentBenchmark,
): Investment | null {
  if (!price || price < 10000) return null;
  const rent = rentMonthly(region, propertyType, areaM2, name, locality, bench);
  if (!rent.monthly) return null;
  let monthly = rent.monthly;
  if (ownership === "druzstevni") monthly = Math.round(monthly * 0.92);
  const annual = monthly * 12;
  const gross = (annual / price) * 100;
  const net = gross * 0.85;
  const payback = price / annual;

  let stars: number;
  let verdict: string;
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
    rent_per_m2: rent.perM2 ?? undefined,
    rent_basis_label: rent.basisLabel,
    rent_source: rent.source,
  };
}

export function fmtPrice(p: number): string {
  if (!p) return "Neuvedeno";
  return `${p.toLocaleString("cs-CZ").replace(/,/g, " ")} Kč`;
}

export function parsePrice(text: string | number | null | undefined): number {
  if (typeof text === "number") return Math.floor(text);
  if (!text) return 0;
  const t = String(text).replace(/\u00a0|\u202f/g, " ");
  const m = t.match(/(\d[\d\s.]*)/);
  if (!m) return 0;
  const digits = m[1].replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function cleanText(s: unknown): string {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

export function parseArea(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  // Match integer with optional Czech decimal (comma or dot) immediately
  // before "m2" / "m²". Avoids the bug where "62,24 m2" was parsed as 24.
  const s = String(text);
  const re = /(\d{1,4})(?:[.,](\d{1,2}))?\s*m[²2]/gi;
  let best: number | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const whole = parseInt(m[1], 10);
    const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
    const n = Math.round(whole + frac);
    if (n > 0 && n < 100000) {
      best = n;
      break; // first occurrence near "m2" wins
    }
  }
  return best;
}

export function parseOwnership(text: string | undefined | null): Ownership | undefined {
  if (!text) return undefined;
  const t = String(text).toLowerCase();
  const plain = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/dru[žz]stevn|druzstevn|\bdv\b|p[řr]evod\s+(?:[čc]lensk|[čc]lensk[ée]ho)|prevod\s+clensk|[čc]lensk[ýy]\s+pod[íi]l|clensky\s+podil|anuita|nesplacen[áa]\s+anuita/.test(t) || /druzstevn|\bdv\b|prevod\s+clensk|clensky\s+podil|anuita|nesplacena\s+anuita/.test(plain)) return "druzstevni";
  if (/osobn[íi]\s*vlastnictv|\bov\b|do\s+osobn[íi]ho\s+vlastnictv|v\s+osobn[íi]m\s+vlastnictv|bytov[áa]\s+jednotka|jednotka\s+v\s+osobn/.test(t) || /osobni\s+vlastnictv|\bov\b|do\s+osobniho\s+vlastnictv|v\s+osobnim\s+vlastnictv|bytova\s+jednotka/.test(plain)) return "osobni";
  if (/st[áa]tn[íi]|obecn[íi]/.test(t) || /statni|obecni/.test(plain)) return "jine";
  return undefined;
}

export function fallbackOwnership(dealType: DealType, propertyType: PropertyType): Ownership {
  if (dealType === "prodej" && (propertyType === "byty" || propertyType === "domy")) return "osobni";
  return "jine";
}
