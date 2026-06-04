import type { Listing, ScanFilters } from "../types";
import { cleanText, parsePrice, parseArea, parseOwnership } from "../valuation";

// Subdomain + path per category/deal type
const CAT_DEAL: Record<string, { sub: string; sale: string; rent: string }> = {
  byty: { sub: "byty", sale: "byty-prodej", rent: "byty-pronajem" },
  domy: { sub: "domy", sale: "domy-prodej", rent: "domy-pronajem" },
  pozemky: { sub: "pozemky", sale: "pozemky-prodej", rent: "pozemky-pronajem" },
  komercni: { sub: "komercni-objekty", sale: "komercni-objekty-prodej", rent: "komercni-objekty-pronajem" },
  ostatni: { sub: "garaze", sale: "garaze-prodej", rent: "garaze-pronajem" },
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

export async function fetchHyperinzerce(f: ScanFilters): Promise<Listing[]> {
  const cfg = CAT_DEAL[f.property_type] || CAT_DEAL.byty;
  const path = f.deal_type === "pronajem" ? cfg.rent : cfg.sale;
  const url = `https://${cfg.sub}.hyperinzerce.cz/${path}`;
  const cap = Math.max(1, Math.min(100, f.per_source_limit || 20));

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "cs-CZ,cs;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Hyperinzerce HTTP ${res.status}`);
  const html = await res.text();

  const blockRe = /<div class="c-ad-list__item js-ad-list-link[^"]*"\s+data-link="([^"]+)"[\s\S]*?(?=<div class="c-ad-list__item js-ad-list-link|<div class="c-pagination|<\/main>)/g;
  const out: Listing[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    if (out.length >= cap) break;
    const detailUrl = m[1];
    const block = m[0];

    const titleM = block.match(/class="c-ad-list__item-name"[^>]*>([\s\S]*?)<\/a>/);
    const title = titleM ? cleanText(stripTags(titleM[1])) : "Hyperinzerce inzerát";

    const imgM = block.match(/<img class="c-ad-list__item-image"[^>]+src="([^"]+)"/);
    const img = imgM ? imgM[1] : "";

    const priceM = block.match(/<div class="c-ad-list__item-price">\s*<span>([\s\S]*?)<\/span>/);
    const priceText = priceM ? cleanText(stripTags(priceM[1])) : "";

    const locM = block.match(/<span class="c-ad-list__item-location">([\s\S]*?)<\/span>/);
    const locality = locM ? cleanText(stripTags(locM[1])) : "";

    const descM = block.match(/<div class="c-ad-list__item-description">([\s\S]*?)<\/div>/);
    const desc = descM ? stripTags(descM[1]) : "";
    const ownership = parseOwnership(title + " " + desc);

    const area_m2 = parseArea(title + " " + desc);

    out.push({
      source: "Hyperinzerce",
      source_key: "hyperinzerce",
      name: title,
      locality,
      price: parsePrice(priceText),
      price_text: priceText || "Dohodou",
      url: detailUrl,
      img,
      area: area_m2 ? `${area_m2} m²` : "",
      area_m2,
      ownership,
      description_snippet: desc ? desc.slice(0, 600) : undefined,
      invest: null,
    });
  }
  return out;
}
