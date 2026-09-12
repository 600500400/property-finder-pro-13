// Cheap regex/keyword red-flag detector. Pure, no I/O. Runs on every persist.

export type FlagCategory = "price_trap" | "foreign" | "type_nuance" | "discrepancy";

export interface Flag {
  code: string;
  category: FlagCategory;
  label: string;
  snippet?: string;
}

interface Rule {
  code: string;
  category: FlagCategory;
  label: string;
  re: RegExp;
}

// Diacritics-insensitive matching: lowercase + strip combining marks.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const RULES: Rule[] = [
  // Price traps
  { code: "anuita",       category: "price_trap", label: "Anuita v textu",                     re: /\banuit/ },
  { code: "doplatek",     category: "price_trap", label: "Doplatek úvěru",                     re: /\bdoplat/ },
  { code: "provize",      category: "price_trap", label: "+ provize RK",                       re: /\bprovize\b|\+\s*provize|provize\s+real/ },
  { code: "bez_dph",      category: "price_trap", label: "Cena bez DPH",                       re: /\bbez\s*dph\b/ },
  { code: "drazba",       category: "price_trap", label: "Dražba / aukce / exekuce",           re: /\bdrazb|\baukc|\bexekuc|\binsolven/ },
  { code: "podil",        category: "price_trap", label: "Spoluvlastnický podíl",              re: /\bspoluvlastnick|\bpodil(?:\s|u|y|em|ova)/ },
  { code: "demolice",     category: "price_trap", label: "K demolici / ruina",                 re: /\bk\s*demolici|\bdemolic|\bruina\b|\bzricenin/ },
  { code: "garaz_only",   category: "type_nuance", label: "Prodej garáže, ne domu",            re: /\bprodej\s+garaz|\bprodej\s+garaze\b/ },
  { code: "pozemek_only", category: "type_nuance", label: "Prodej pozemku, ne domu",           re: /\bprodej\s+(?:stavebn\w*\s+)?pozemk|\bstavebni\s+parcela\b/ },
  { code: "montovany",    category: "type_nuance", label: "Montovaný / typový dům (bez pozemku)", re: /\bmontovan|\bshowroom|\btypov\w*\s+d(?:um|omy)|\bmobilni\s+d(?:um|omek)|\bdum\s+na\s+klic/ },

  // Foreign property
  { code: "foreign_es",   category: "foreign",    label: "Možná zahraniční (Španělsko)",       re: /\bspanel/ },
  { code: "foreign_hr",   category: "foreign",    label: "Možná zahraniční (Chorvatsko)",      re: /\bchorvat/ },
  { code: "foreign_it",   category: "foreign",    label: "Možná zahraniční (Itálie)",          re: /\bitali/ },
  { code: "foreign_bg",   category: "foreign",    label: "Možná zahraniční (Bulharsko)",       re: /\bbulhar/ },
  { code: "foreign_gr",   category: "foreign",    label: "Možná zahraniční (Řecko)",           re: /\breck/ },
  { code: "foreign_gen",  category: "foreign",    label: "Možná zahraniční nemovitost",        re: /\bzahranic/ },

  // Type nuances
  { code: "druzstevni",   category: "type_nuance", label: "Družstevní vlastnictví",            re: /\bdruzstevn/ },
  { code: "pred_rek",     category: "type_nuance", label: "Před rekonstrukcí",                 re: /\bpred\s+rekonstrukc/ },
  { code: "k_rek",        category: "type_nuance", label: "K rekonstrukci",                    re: /\bk\s+rekonstrukc/ },
  { code: "obsazeno",     category: "type_nuance", label: "Obsazeno nájemníkem",               re: /\bobsazeno\s+najemn|\bnajemnik\s+v\s+byt/ },
];

const CZ_REGIONS = new Set([
  "praha","stredocesky","jihocesky","jihomoravsky","karlovarsky","kralovehradecky",
  "liberecky","moravskoslezsky","olomoucky","pardubicky","plzensky","ustecky",
  "vysocina","zlinsky",
]);

function snippetAround(text: string, re: RegExp, originalText: string): string | undefined {
  const m = norm(text).match(re);
  if (!m || m.index === undefined) return undefined;
  // Map back to original text by character index (norm preserves length per-char approx; use index as-is).
  const start = Math.max(0, m.index - 30);
  const end = Math.min(originalText.length, m.index + (m[0]?.length ?? 0) + 60);
  return "…" + originalText.slice(start, end).replace(/\s+/g, " ").trim() + "…";
}

interface DetectInput {
  title?: string | null;
  description?: string | null;
  raw_data?: unknown;
  price?: number | null;
  area_m2?: number | null;
  kraj?: string | null;
}

function collectText(input: DetectInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.description) parts.push(input.description);
  const r = input.raw_data;
  if (r && typeof r === "object") {
    for (const v of Object.values(r as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0 && v.length < 5000) parts.push(v);
    }
  }
  return parts.join(" \n ");
}

function detectDiscrepancy(text: string, price: number | null | undefined, area_m2: number | null | undefined): Flag | null {
  if (!text) return null;
  const out: Flag = { code: "discrepancy", category: "discrepancy", label: "Údaje v textu nesedí" };
  // Area in text e.g. "85 m2", "85m²"
  if (area_m2 && area_m2 > 0) {
    const m = text.match(/(\d{2,4})\s*m\s*[2²]/i);
    if (m) {
      const inText = Number(m[1]);
      if (inText > 0) {
        const diff = Math.abs(inText - area_m2) / area_m2;
        if (diff > 0.15 && Math.abs(inText - area_m2) > 5) {
          return { ...out, label: `Plocha v textu (${inText} m²) ≠ ${area_m2} m²` };
        }
      }
    }
  }
  // Price in text e.g. "4 500 000 Kč" or "4,5 mil"
  if (price && price > 100_000) {
    const milMatch = text.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*mil/i);
    if (milMatch) {
      const inText = Math.round(Number(milMatch[1].replace(",", ".")) * 1_000_000);
      if (inText > 0) {
        const diff = Math.abs(inText - price) / price;
        if (diff > 0.15 && Math.abs(inText - price) > 200_000) {
          return { ...out, label: `Cena v textu (${milMatch[0]}) ≠ struktur. ceny` };
        }
      }
    }
  }
  return null;
}

export function detectFlags(input: DetectInput): Flag[] {
  const fullText = collectText(input);
  if (!fullText) return [];
  const normText = norm(fullText);
  const found: Flag[] = [];
  const seen = new Set<string>();

  for (const r of RULES) {
    if (seen.has(r.code)) continue;
    if (r.category === "foreign") {
      // Only fire if listing has no recognized CZ kraj
      if (input.kraj && CZ_REGIONS.has(input.kraj)) continue;
    }
    if (r.re.test(normText)) {
      seen.add(r.code);
      found.push({
        code: r.code,
        category: r.category,
        label: r.label,
        snippet: snippetAround(fullText, r.re, fullText),
      });
    }
  }

  const disc = detectDiscrepancy(normText, input.price ?? null, input.area_m2 ?? null);
  if (disc) found.push(disc);

  return found;
}

/** Flag codes that disqualify a listing from the price/m² COMPARABLE POOL.
 * They stay visible in the feed — they just must not pollute the medians. */
export const EXCLUDED_FROM_COMPS = [
  "podil", "drazba", "demolice", "garaz_only", "pozemek_only", "montovany",
] as const;

const EXCLUDED_SET = new Set<string>(EXCLUDED_FROM_COMPS);

/** Text fallback for legacy rows whose flags were computed before these rules existed. */
const JUNK_TEXT_RE = /spoluvlastnick|podil|drazb|aukc|exekuc|demolic|ruina|montovan|showroom|typovy dum|mobilni dum|prodej pozemk|prodej garaz/;

export function isCompEligible(input: { flags?: unknown; title?: string | null }): boolean {
  const flags = Array.isArray(input.flags) ? (input.flags as Array<{ code?: string }>) : [];
  if (flags.some(f => f?.code && EXCLUDED_SET.has(f.code))) return false;
  if (input.title) {
    const t = input.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (JUNK_TEXT_RE.test(t)) return false;
  }
  return true;
}

export function hasPriceTrap(flags: Flag[] | undefined | null): boolean {
  if (!flags) return false;
  return flags.some(f => f.category === "price_trap");
}
