import type { Listing, ScanFilters } from "../types";
import { cleanText, fmtPrice, parsePrice } from "../valuation";

function absUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return base + href;
  return base + "/" + href;
}

// crude HTML attr extractor
function attr(html: string, name: string): string {
  const m = html.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m ? m[1] : "";
}

export async function fetchBazos(f: ScanFilters): Promise<Listing[]> {
  const base = "https://reality.bazos.cz";
  const cat = f.property_type === "byty" ? "byt" :
              f.property_type === "domy" ? "dum" :
              f.property_type === "pozemky" ? "pozemek" : "garaz";
  const path = f.deal_type === "pronajem" ? `/pronajmu/${cat}/` : `/prodam/${cat}/`;
  const qs = new URLSearchParams();
  if (f.price_min) qs.set("cenaod", String(f.price_min));
  if (f.price_max) qs.set("cenado", String(f.price_max));
  const url = base + path + (qs.toString() ? `?${qs}` : "");

  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept-Language": "cs-CZ,cs;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Bazoš HTTP ${r.status}`);
  const html = await r.text();

  // each listing block ~ div.inzeraty
  const blocks = html.split(/<div\s+class=["']inzeraty\s+inzeratyflex["']/i).slice(1);
  const out: Listing[] = [];
  for (const raw of blocks.slice(0, 25)) {
    const block = "<div" + raw.split(/<div\s+class=["']inzeraty/i)[0];
    // title + link
    const linkMatch = block.match(/<h2[^>]*class=["']nadpis["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    let href = "", title = "";
    if (linkMatch) {
      href = linkMatch[1];
      title = cleanText(linkMatch[2].replace(/<[^>]+>/g, ""));
    } else {
      const a = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
      if (a) { href = a[1]; title = cleanText(a[2]); }
    }
    if (!href) continue;
    // price
    const priceM = block.match(/class=["'][^"']*inzeratycena[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const priceText = priceM ? cleanText(priceM[1].replace(/<[^>]+>/g, "")) : "";
    // locality
    const locM = block.match(/class=["'][^"']*inzeratylok[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const locality = locM ? cleanText(locM[1].replace(/<[^>]+>/g, "")) : "";
    // image
    const imgM = block.match(/<img[^>]+src=["']([^"']+)["']/i);
    const img = imgM ? absUrl(imgM[1], base) : "";

    out.push({
      source: "Bazoš",
      source_key: "bazos",
      name: title || `Inzerát Bazoš`,
      locality,
      price: parsePrice(priceText),
      price_text: priceText || "Dohodou",
      url: absUrl(href, base),
      img,
      area: "",
      invest: null,
    });
  }
  return out;
}
