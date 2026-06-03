import type { Investment, Ownership, PropertyType, Region } from "./types";

// Estimated monthly rent per m² (CZK), Czech market 2024–2025.
// Sources: Deloitte Rent Index Q3 2024, RealityČechy průměry, ČSÚ.
// Krajský medián pro byty 2+kk; pro 1+kk uprav +15 %, pro 4+ uprav −10 %.
const RENT_PER_M2_APT: Record<string, number> = {
  praha: 415,
  brnoMesto: 360, // pokud bychom rozlišovali
  jihomoravsky: 330,
  stredocesky: 290,
  plzensky: 280,
  jihocesky: 260,
  kralovehradecky: 240,
  liberecky: 245,
  moravskoslezsky: 230,
  olomoucky: 235,
  pardubicky: 235,
  zlinsky: 225,
  ustecky: 195,
  karlovarsky: 205,
  vysocina: 215,
  "": 270, // národní průměr
};

// Fixed monthly rent for garages/parking (no per-m² logic — small static asset)
const REGION_RENT_GARAGE: Record<string, number> = {
  "": 2200,
  praha: 3500,
  stredocesky: 2200,
  jihocesky: 1600,
  jihomoravsky: 2400,
  karlovarsky: 1500,
  kralovehradecky: 1700,
  liberecky: 1600,
  moravskoslezsky: 1800,
  olomoucky: 1700,
  pardubicky: 1600,
  plzensky: 2000,
  ustecky: 1500,
  vysocina: 1500,
  zlinsky: 1700,
};

// Typical area fallbacks (when ad doesn't expose m²)
const FALLBACK_AREA: Record<string, number> = {
  byty: 55,
  domy: 130,
  komercni: 80,
  pozemky: 0,
  ostatni: 0,
};

function dispositionFactor(name: string): number {
  const n = name.toLowerCase();
  if (/(1\+kk|1\+1|garsoni)/.test(n)) return 1.15;
  if (/(2\+kk|2\+1)/.test(n)) return 1.05;
  if (/(3\+kk|3\+1)/.test(n)) return 1.0;
  if (/(4\+kk|4\+1)/.test(n)) return 0.95;
  if (/(5\+kk|5\+1|6\+)/.test(n)) return 0.9;
  return 1.0;
}

function rentMonthly(
  price: number,
  region: Region,
  propertyType: PropertyType,
  areaM2: number | undefined,
  name: string
): number | null {
  if (propertyType === "ostatni") {
    return REGION_RENT_GARAGE[region] ?? REGION_RENT_GARAGE[""];
  }
  if (propertyType === "pozemky") return null;
  const perM2Base = RENT_PER_M2_APT[region] ?? RENT_PER_M2_APT[""];
  const typeMult = propertyType === "domy" ? 0.8
    : propertyType === "komercni" ? 0.9
    : 1.0;
  const dispMult = propertyType === "byty" ? dispositionFactor(name) : 1.0;
  const perM2 = perM2Base * typeMult * dispMult;
  const area = areaM2 && areaM2 > 5 ? areaM2 : FALLBACK_AREA[propertyType];
  if (!area) return null;
  return Math.round(perM2 * area);
}

export function calcYield(
  price: number,
  region: Region,
  propertyType: PropertyType,
  areaM2?: number,
  name: string = "",
  ownership?: Ownership,
): Investment | null {
  if (!price || price < 10000) return null;
  let monthly = rentMonthly(price, region, propertyType, areaM2, name);
  if (!monthly) return null;
  // Družstevní byty mají typicky o 5–10 % nižší nájem (omezení převodu, fond oprav)
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
  const m = String(text).match(/(\d{1,5})\s*m[²2]/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return n > 0 && n < 100000 ? n : undefined;
}

export function parseOwnership(text: string | undefined | null): Ownership | undefined {
  if (!text) return undefined;
  const t = String(text).toLowerCase();
  if (/dru[žz]stevn|\bdv\b/.test(t)) return "druzstevni";
  if (/osobn[íi]\s*vlastnictv|\bov\b/.test(t)) return "osobni";
  if (/st[áa]tn[íi]/.test(t)) return "statni";
  return undefined;
}
