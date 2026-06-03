import type { Listing, ScanFilters } from "../types";
import { cleanText, parsePrice, parseArea, parseOwnership } from "../valuation";

const CAT_URL: Record<string, string> = {
  byty: "byty-na-prodej.html",
  domy: "domy-na-prodej.html",
  pozemky: "pozemky-na-prodej.html",
  komercni: "komercni-prostory.html",
  ostatni: "garaze.html",
};

const CAT_URL_RENT: Record<string, string> = {
  byty: "byty-do-pronajmu.html",
  domy: "domy-k-pronajmu.html",
  pozemky: "pozemky-k-pronajmu.html",
  komercni: "komercni-prostory-k-pronajmu.html",
  ostatni: "garaze-k-pronajmu.html",
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function parseAnnDate(s: string): string | undefined {
  const m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function fetchAnnonce(f: ScanFilters): Promise<Listing[]> {
  const slug = (f.deal_type === "pronajem" ? CAT_URL_RENT : CAT_URL)[f.property_type] || CAT_URL.byty;
  const url = `https://www.annonce.cz/${slug}`;
  const cap = Math.max(1, Math.min(100, f.per_source_limit || 20));

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "cs-CZ,cs;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Annonce HTTP ${res.status}`);
  const html = await res.text();

  // Listing card: <div class="box q ext-item slideshow" ...> ... </div> followed by next card
  const blockRe = /<div class="box q ext-item[^"]*"[\s\S]*?(?=<div class="box q ext-item|<div id="full-banner"|<div class="m-square"|<div id="pagination)/g;
  const out: Listing[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    if (out.length >= cap) break;
    const block = m[0];

    const linkM = block.match(/<h2><a href="(https:\/\/www\.annonce\.cz\/inzerat\/[^"]+)"/);
    if (!linkM) continue;
    const detailUrl = linkM[1];

    const titleM = block.match(/<h2><a [^>]*>([\s\S]*?)<\/a>/);
    const title = titleM ? cleanText(stripTags(titleM[1])) : "Annonce inzerát";

    const imgM = block.match(/<a class="thumbnail"[^>]*>\s*<img[^>]+src="([^"]+)"/);
    const img = imgM ? imgM[1] : "";

    const priceM = block.match(/<strong class="mini-sticker"><span>([\s\S]*?)<\/span>/);
    const priceText = priceM ? cleanText(stripTags(priceM[1])) : "";

    const dateM = block.match(/<div class="ad-date">([\s\S]*?)<\/div>/);
    const published_at = dateM ? parseAnnDate(stripTags(dateM[1])) : undefined;

    // locality: last <a> in attrs table with "f-R384"
    const locM = block.match(/href="https:\/\/www\.annonce\.cz\/[^"]*-f-R\d+\.html">([^<]+)</);
    const locality = locM ? cleanText(locM[1]) : "";

    // ownership
    let ownership = parseOwnership(block);
    const ownM = block.match(/data-name-id="property_type"[\s\S]*?<td>([\s\S]*?)<\/td>/);
    if (ownM) {
      const t = cleanText(stripTags(ownM[1])).toLowerCase();
      if (t.includes("družstevní") || t.includes("druzstevni")) ownership = "druzstevni";
      else if (t.includes("osobní") || t.includes("osobni")) ownership = "osobni";
      else if (t.includes("státní") || t.includes("statni")) ownership = "statni";
    }

    // area
    let area_m2 = parseArea(title);
    const areaM = block.match(/data-name-id="area"[\s\S]*?<td>\s*(\d+)\s*m2/);
    if (areaM) area_m2 = parseInt(areaM[1], 10);

    out.push({
      source: "Annonce",
      source_key: "annonce",
      name: title,
      locality,
      price: parsePrice(priceText),
      price_text: priceText || "Dohodou",
      url: detailUrl,
      img,
      area: area_m2 ? `${area_m2} m²` : "",
      area_m2,
      published_at,
      published_at_source: published_at ? "html" : undefined,
      ownership,
      invest: null,
    });
  }
  return out;
}
