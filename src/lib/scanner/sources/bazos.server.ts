import type { Listing, ScanFilters } from "../types";
import { cleanText, fmtPrice, parsePrice } from "../valuation";

const BAZOS_CAT: Record<string, string> = {
  byty: "byt",
  domy: "dum",
  pozemky: "pozemek",
  komercni: "nebytove",
  ostatni: "garaz",
};

function buildUrl(f: ScanFilters): string {
  const cat = BAZOS_CAT[f.property_type] || "garaz";
  const deal = f.deal_type === "pronajem" ? "pronajmu" : "prodam";
  const qs = new URLSearchParams();
  if (f.price_min) qs.set("cenaod", String(f.price_min));
  if (f.price_max) qs.set("cenado", String(f.price_max));
  const q = qs.toString();
  return `https://reality.bazos.cz/${deal}/${cat}/${q ? "?" + q : ""}`;
}

// strip <tag> ... </tag> while keeping inner text
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

export async function fetchBazos(f: ScanFilters): Promise<Listing[]> {
  const url = buildUrl(f);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "cs-CZ,cs;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Bazoš HTTP ${res.status}`);
  const html = await res.text();

  // Split into listing blocks
  const blockRe = /<div class="inzeraty inzeratyflex">([\s\S]*?)(?=<div class="inzeraty inzeratyflex">|<div class="strankovani)/g;
  const out: Listing[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    if (out.length >= 20) break;
    const block = m[1];

    const linkM = block.match(/<a href="(\/inzerat\/[^"]+)"/);
    if (!linkM) continue;
    const href = linkM[1];
    const detailUrl = `https://reality.bazos.cz${href}`;

    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    const img = imgM ? imgM[1] : "";

    const titleM = block.match(/<h2 class=nadpis><a [^>]*>([\s\S]*?)<\/a>/);
    const title = titleM ? cleanText(stripTags(titleM[1])) : "Bazoš inzerát";

    const priceM = block.match(/<div class="inzeratycena">[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);
    const priceText = priceM ? cleanText(stripTags(priceM[1])) : "";

    const locM = block.match(/<div class="inzeratylok">([\s\S]*?)<\/div>/);
    const locality = locM ? cleanText(stripTags(locM[1]).replace(/\d{3}\s?\d{2}/g, "").trim()) : "";

    out.push({
      source: "Bazoš",
      source_key: "bazos",
      name: title,
      locality,
      price: parsePrice(priceText),
      price_text: priceText || "Dohodou",
      url: detailUrl,
      img,
      area: "",
      invest: null,
    });
  }
  return out;
}
