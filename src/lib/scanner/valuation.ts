import type { Investment, PropertyType, Region } from "./types";

// Estimated monthly rent per m² (CZK), based on Czech market 2024–2025 averages.
// Source: Deloitte Rent Index, sReality/Bezrealitky averages. Regional median.
const RENT_PER_M2_APT: Record<string, number> = {
  praha: 380,
  stredocesky: 260,
  jihomoravsky: 290, // Brno-driven
  plzensky: 240,
  jihocesky: 230,
  kralovehradecky: 220,
  liberecky: 230,
  moravskoslezsky: 200,
  olomoucky: 210,
  pardubicky: 215,
  zlinsky: 210,
  ustecky: 180,
  karlovarsky: 190,
  vysocina: 200,
  "": 230, // národní průměr
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

function rentMonthly(price: number, region: Region, propertyType: PropertyType, areaM2: number | undefined): number | null {
  if (propertyType === "ostatni") {
    return REGION_RENT_GARAGE[region] ?? REGION_RENT_GARAGE[""];
  }
  if (propertyType === "pozemky") return null; // pozemky se nepronajímají běžně
  const perM2Base = RENT_PER_M2_APT[region] ?? RENT_PER_M2_APT[""];
  const perM2 = propertyType === "domy" ? perM2Base * 0.8
    : propertyType === "komercni" ? perM2Base * 0.9
    : perM2Base;
  const area = areaM2 && areaM2 > 5 ? areaM2 : FALLBACK_AREA[propertyType];
  if (!area) return null;
  return Math.round(perM2 * area);
}

export function calcYield(
  price: number,
  region: Region,
  propertyType: PropertyType,
  areaM2?: number
): Investment | null {
  if (!price || price < 10000) return null;
  const monthly = rentMonthly(price, region, propertyType, areaM2);
  if (!monthly) return null;
  const annual = monthly * 12;
  const gross = (annual / price) * 100;
  const net = gross * 0.85; // odhad po nákladech (daně, údržba, výpadky)
  const payback = price / annual;

  // Thresholdy: garáže mají historicky vyšší výnos než byty
  const isGarage = propertyType === "ostatni";
  let stars: number;
  let verdict: string;
  if (isGarage) {
    if (net >= 6) { stars = 5; verdict = "Výborná investice 🏆"; }
    else if (net >= 5) { stars = 4; verdict = "Dobrá investice ✅"; }
    else if (net >= 4) { stars = 3; verdict = "Průměrný výnos ⚖️"; }
    else if (net >= 3) { stars = 2; verdict = "Podprůměrné ⚠️"; }
    else { stars = 1; verdict = "Nevýhodné ❌"; }
  } else {
    if (net >= 6) { stars = 5; verdict = "Výborná investice 🏆"; }
    else if (net >= 5) { stars = 4; verdict = "Dobrá investice ✅"; }
    else if (net >= 4) { stars = 3; verdict = "Průměrný výnos ⚖️"; }
    else if (net >= 3) { stars = 2; verdict = "Podprůměrné ⚠️"; }
    else { stars = 1; verdict = "Nevýhodné ❌"; }
  }

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
