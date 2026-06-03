import Firecrawl from "@mendable/firecrawl-js";
import type { Listing, ScanFilters, SourceKey } from "../types";
import { cleanText, parsePrice, parseArea } from "../valuation";

function client() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY není nastaveno");
  return new Firecrawl({ apiKey });
}

// ---------- URL builders per portal ----------

const IDNES_REGION: Record<string, string> = {
  praha: "praha", stredocesky: "stredocesky", jihocesky: "jihocesky",
  jihomoravsky: "jihomoravsky", karlovarsky: "karlovarsky",
  kralovehradecky: "kralovehradecky", liberecky: "liberecky",
  moravskoslezsky: "moravskoslezsky", olomoucky: "olomoucky",
  pardubicky: "pardubicky", plzensky: "plzensky", ustecky: "ustecky",
  vysocina: "vysocina", zlinsky: "zlinsky",
};

function buildIdnesUrl(f: ScanFilters): string {
  const deal = f.deal_type === "pronajem" ? "pronajem" : "prodej";
  const cat = f.property_type === "byty" ? "byty"
    : f.property_type === "domy" ? "domy"
    : f.property_type === "pozemky" ? "pozemky"
    : f.property_type === "komercni" ? "komercni-objekty"
    : "garaze";
  const region = f.region ? IDNES_REGION[f.region] : "";
  return `https://reality.idnes.cz/s/${deal}/${cat}/${region ? region + "/" : ""}`;
}

function buildRealityMixUrl(f: ScanFilters): string {
  const deal = f.deal_type === "pronajem" ? "pronajem" : "prodej";
  const cat = f.property_type === "byty" ? "byty"
    : f.property_type === "domy" ? "domy"
    : f.property_type === "pozemky" ? "pozemky"
    : f.property_type === "komercni" ? "komercni"
    : "garaze";
  return `https://www.realitymix.cz/vypis-nemovitosti-na-prodej/${cat}-${deal}.html`;
}

function buildAnnonceUrl(f: ScanFilters): string {
  const deal = f.deal_type === "pronajem" ? "pronajem" : "prodej";
  const cat = f.property_type === "byty" ? "byty"
    : f.property_type === "domy" ? "domy-a-vily"
    : f.property_type === "pozemky" ? "pozemky"
    : f.property_type === "komercni" ? "komercni-prostory"
    : "garaze";
  return `https://reality.annonce.cz/${deal}-${cat}/`;
}

function buildHyperinzerceUrl(f: ScanFilters): string {
  const deal = f.deal_type === "pronajem" ? "pronajem" : "prodej";
  const cat = f.property_type === "byty" ? "byty"
    : f.property_type === "domy" ? "domy"
    : f.property_type === "pozemky" ? "pozemky"
    : f.property_type === "komercni" ? "komercni-objekty"
    : "garaze";
  return `https://reality.hyperinzerce.cz/${deal}-${cat}/inzeraty/`;
}

// ---------- Generic Firecrawl-based extractor ----------

const LISTING_SCHEMA = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Název / nadpis inzerátu" },
          url: { type: "string", description: "Absolutní URL detailu inzerátu (musí začínat http nebo https)" },
          price_text: { type: "string", description: "Cena tak, jak je v inzerátu (např. '350 000 Kč', 'Dohodou')" },
          locality: { type: "string", description: "Lokalita / město / okres" },
          image: { type: "string", description: "Absolutní URL náhledového obrázku (musí začínat http nebo https, NE data-src, NE tracking pixel, NE 1×1 placeholder)" },
          published_date: { type: "string", description: "Datum zveřejnění inzerátu pokud je viditelné (formát YYYY-MM-DD nebo DD.MM.YYYY)" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: ["listings"],
} as const;

const PROMPT = "Extrahuj seznam realitních inzerátů ze stránky výpisu. Pro každý inzerát najdi titulek, ABSOLUTNÍ URL detailu (musí začínat https://), cenu (přesný text vč. měny), lokalitu a ABSOLUTNÍ URL náhledové fotky. U obrázku zkontroluj atributy src, data-src, data-original, data-lazy a srcset (ze srcset vezmi první URL). Vynech 1×1 pixel placeholdery, base64 data: URI a tracking pixely. Vynech reklamní, doporučené a sponzorované bloky, paginaci a opakující se navigaci. Maximálně 20 položek.";

interface ExtractedItem {
  title?: string;
  url?: string;
  price_text?: string;
  locality?: string;
  image?: string;
  published_date?: string;
}

function parsePublishedDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const m2 = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  let d: Date | null = null;
  if (m1) d = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
  else if (m2) d = new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  return d && !isNaN(d.getTime()) ? d.toISOString() : undefined;
}

function absolutize(u: string | undefined, base: string): string {
  if (!u) return "";
  const v = u.trim();
  if (!v) return "";
  if (v.startsWith("data:")) return "";
  if (/blank\.(gif|png)|1x1|spacer\.(gif|png)/i.test(v)) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return "https:" + v;
  try {
    const baseOrigin = new URL(base).origin;
    if (v.startsWith("/")) return baseOrigin + v;
    return baseOrigin + "/" + v.replace(/^\.?\//, "");
  } catch {
    return "";
  }
}

async function scrapeViaFirecrawl(
  url: string,
  sourceLabel: string,
  sourceKey: SourceKey,
  opts?: { onlyMainContent?: boolean; waitFor?: number }
): Promise<Listing[]> {
  const fc = client();
  const result = await fc.scrape(url, {
    formats: [{ type: "json", schema: LISTING_SCHEMA as unknown as object, prompt: PROMPT }],
    onlyMainContent: opts?.onlyMainContent ?? false,
    waitFor: opts?.waitFor ?? 2500,
    timeout: 60000,
  } as Parameters<typeof fc.scrape>[1]);

  const r = result as unknown as { json?: { listings?: ExtractedItem[] }; data?: { json?: { listings?: ExtractedItem[] } } };
  const items: ExtractedItem[] = r.json?.listings ?? r.data?.json?.listings ?? [];

  const out: Listing[] = [];
  for (const it of items.slice(0, 30)) {
    if (!it.url || !it.title) continue;
    const absUrl = absolutize(it.url, url);
    if (!absUrl) continue;
    const priceText = cleanText(it.price_text || "");
    const title = cleanText(it.title);
    const area_m2 = parseArea(title);
    out.push({
      source: sourceLabel,
      source_key: sourceKey,
      name: title,
      locality: cleanText(it.locality || ""),
      price: parsePrice(priceText),
      price_text: priceText || "Dohodou",
      url: absUrl,
      img: absolutize(it.image, url),
      area: area_m2 ? `${area_m2} m²` : "",
      area_m2,
      published_at: parsePublishedDate(it.published_date),
      invest: null,
    });
  }
  return out;
}

// ---------- Public functions ----------

export const fetchIdnes = (f: ScanFilters) =>
  scrapeViaFirecrawl(buildIdnesUrl(f), "iDnes Reality", "idnes");

export const fetchRealityMix = (f: ScanFilters) =>
  scrapeViaFirecrawl(buildRealityMixUrl(f), "RealityMix", "realitymix");

export const fetchAnnonce = (f: ScanFilters) =>
  scrapeViaFirecrawl(buildAnnonceUrl(f), "Annonce", "annonce", { onlyMainContent: false, waitFor: 3500 });

export const fetchHyperinzerce = (f: ScanFilters) =>
  scrapeViaFirecrawl(buildHyperinzerceUrl(f), "Hyperinzerce", "hyperinzerce");

