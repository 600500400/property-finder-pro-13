import type { Listing } from "./types";

// Anti-balast: vyřazení zahraničních inzerátů a očividných nesmyslů.

const FOREIGN_KEYWORDS = [
  "španělsk", "spanelsk", "spain",
  "itálie", "italie", "italy", "italsk",
  "bulharsk", "bulgaria",
  "chorvatsk", "croatia",
  "slovensk", "slovakia", "slovak",
  "rakousk", "austria",
  "německ", "nemeck", "germany",
  "tureck", "turkey",
  "kypr", "cyprus",
  "thajsk", "thailand",
  "egypt",
  "uae", "dubai", "abu dhabi",
  "portugal", "portugals",
  "francie", "french", "france",
  "řeck", "recko", "greece",
  "maďar", "madar", "hungary",
  "polsk", "poland",
  "rumun", "romania",
  "černá hora", "cerna hora", "montenegro",
  "albán", "alban",
  "malta", "maltsk",
  "bali", "indonésie", "indonesie",
  "florida", "miami",
  "mexico", "mexik",
];

const FOREIGN_URL_PATTERNS = [
  /sreality\.cz\/.*zahranicni/i,
  /\/zahranicni-reality\//i,
  /\/foreign\//i,
];

// CZ kraje / hlavní města (whitelist – pokud se objeví, je to jistá ČR)
const CZ_WHITELIST = [
  "praha", "brno", "ostrava", "plzeň", "plzen", "liberec", "olomouc",
  "ústí", "usti", "hradec", "pardubice", "zlín", "zlin", "jihlava",
  "karlovy vary", "české budějovice", "ceske budejovice",
  "kraj", "okres", "česko", "cesko", "čr ", "cr ", "čzr",
];

export interface SanityVerdict {
  ok: boolean;
  reason?: string;
}

export function isCzechListing(l: Listing): SanityVerdict {
  const hay = `${l.name || ""} ${l.locality || ""}`.toLowerCase();
  const url = (l.url || "").toLowerCase();

  if (FOREIGN_URL_PATTERNS.some(re => re.test(url))) {
    return { ok: false, reason: "foreign_url" };
  }
  // Cena v EUR (s mezerou nebo jako symbol €) bez "Kč"
  const priceText = (l.price_text || "").toLowerCase();
  if ((priceText.includes("€") || /\beur\b/.test(priceText)) && !priceText.includes("kč") && !priceText.includes("kc")) {
    return { ok: false, reason: "foreign_currency" };
  }
  for (const kw of FOREIGN_KEYWORDS) {
    if (hay.includes(kw)) {
      // Whitelist override: i v textu má CZ marker → OK (např. "krásný byt blízko německého trhu, Cheb")
      if (CZ_WHITELIST.some(w => hay.includes(w))) continue;
      return { ok: false, reason: `foreign_kw:${kw}` };
    }
  }
  return { ok: true };
}

export interface SanityStats {
  filtered_foreign: number;
  filtered_no_price: number;
  reasons: Record<string, number>;
}

export function applySanity(items: Listing[]): { items: Listing[]; stats: SanityStats } {
  const stats: SanityStats = { filtered_foreign: 0, filtered_no_price: 0, reasons: {} };
  const out = items.filter(l => {
    const v = isCzechListing(l);
    if (!v.ok) {
      stats.filtered_foreign++;
      const r = v.reason || "unknown";
      stats.reasons[r] = (stats.reasons[r] || 0) + 1;
      return false;
    }
    return true;
  });
  return { items: out, stats };
}
