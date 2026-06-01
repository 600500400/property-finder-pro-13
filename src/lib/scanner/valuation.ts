import type { Investment, PropertyType, Region } from "./types";

const REGION_RENT: Record<string, number> = {
  "": 2500,
  praha: 3500,
  stredocesky: 2000,
  jihocesky: 1600,
  jihomoravsky: 2200,
  karlovarsky: 1500,
  kralovehradecky: 1700,
  liberecky: 1600,
  moravskoslezsky: 1800,
  olomoucky: 1700,
  pardubicky: 1600,
  plzensky: 1900,
  ustecky: 1500,
  vysocina: 1500,
  zlinsky: 1700,
};

export function calcYield(
  price: number,
  region: Region,
  propertyType: PropertyType
): Investment | null {
  if (propertyType !== "ostatni" || !price || price < 10000) return null;
  const monthly = REGION_RENT[region] ?? 2000;
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
