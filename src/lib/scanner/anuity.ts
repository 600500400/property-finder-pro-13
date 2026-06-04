import type { AnuityInfo, Ownership } from "./types";

// Klíčové fráze, které naznačují anuitu / nesplacený úvěr družstva
const TRIGGER_RE = /(anuit|nespla[čc]en[ýé]?\s+(?:[úu]v[ěe]r|podíl|zůstatek)|[úu]v[ěe]r\s+dru[žz]stv|zb[ýy]v[áa]\s+doplat|doplat[ek]\s+anuit|p[řr]evzet[íi]\s+[úu]v[ěe]r|nesplacen[áé]\s+anuit)/i;

// Číselný token: "8 500 000", "8.500.000", "8,5", "8.5"
const NUM = "(\\d{1,3}(?:[\\s.,]\\d{3})*(?:[.,]\\d+)?)";
const UNIT = "(?:\\s*)(k[čc]|czk|mil(?:\\.|i[oó]n[ůu]?|i[oó]ny)?|tis(?:\\.|[íi]c[ůu]?)?)";
const AMOUNT_RE = new RegExp(NUM + UNIT, "i");

function parseAmount(numStr: string, unit: string): number | undefined {
  const cleaned = numStr.trim();
  // detekce desetinné čárky/tečky pouze pokud je tam jediná a má 1-2 číslice za ní
  let n: number;
  if (/^\d+[.,]\d{1,2}$/.test(cleaned)) {
    n = parseFloat(cleaned.replace(",", "."));
  } else {
    n = parseInt(cleaned.replace(/[\s.,]/g, ""), 10);
  }
  if (!isFinite(n) || n <= 0) return undefined;
  const u = unit.toLowerCase();
  if (u.startsWith("mil")) return Math.round(n * 1_000_000);
  if (u.startsWith("tis")) return Math.round(n * 1_000);
  return Math.round(n);
}

export function detectAnuity(
  text: string | undefined,
  basePrice: number,
  ownership?: Ownership,
): AnuityInfo {
  const t = text || "";
  const triggered = TRIGGER_RE.test(t);

  if (!triggered) {
    return { has_anuity: false, confidence: "low" };
  }

  // hledej částku v okně ±100 znaků kolem prvního zásahu spouštěče
  const trigMatch = t.match(TRIGGER_RE);
  let amount: number | undefined;
  let snippet: string | undefined;
  if (trigMatch && trigMatch.index !== undefined) {
    const start = Math.max(0, trigMatch.index - 80);
    const end = Math.min(t.length, trigMatch.index + trigMatch[0].length + 120);
    const window = t.slice(start, end);
    snippet = window.replace(/\s+/g, " ").trim();
    const am = window.match(AMOUNT_RE);
    if (am) {
      const cand = parseAmount(am[1], am[2]);
      // filtr na rozumný rozsah anuity (50 tis. – 50 mil.)
      if (cand && cand >= 50_000 && cand <= 50_000_000) amount = cand;
    }
  }

  const effective = amount && basePrice ? basePrice + amount : undefined;
  const confidence: AnuityInfo["confidence"] =
    amount ? "high" : ownership === "druzstevni" ? "medium" : "low";

  return {
    has_anuity: true,
    amount,
    effective_price: effective,
    confidence,
    source_phrase: snippet?.slice(0, 200),
  };
}
