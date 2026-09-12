import type { Listing, ScanFilters } from "../types";
import { cleanText, parsePrice, parseArea, parseOwnership } from "../valuation";

// Parse "[3.6. 2026]" or "3.6.2026" → ISO date
function parseBazosDate(block: string): string | undefined {
  const m = block.match(/\[?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*\]?/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

const BAZOS_CAT: Record<string, string> = {
  byty: "byt",
  domy: "dum",
  pozemky: "pozemek",
  komercni: "nebytove",
  ostatni: "garaz",
};

function buildUrl(f: ScanFilters, offset = 0): string {
  const cat = BAZOS_CAT[f.property_type] || "garaz";
  const deal = f.deal_type === "pronajem" ? "pronajmu" : "prodam";
  const qs = new URLSearchParams();
  if (f.price_min) qs.set("cenaod", String(f.price_min));
  if (f.price_max) qs.set("cenado", String(f.price_max));
  const q = qs.toString();
  // Bazoš pagines through an offset path segment: /prodam/dum/20/
  return `https://reality.bazos.cz/${deal}/${cat}/${offset ? offset + "/" : ""}${q ? "?" + q : ""}`;
}

/** Bazoš lists 20 items per page. */
const BAZOS_PAGE_SIZE = 20;

// strip <tag> ... </tag> while keeping inner text
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

async function fetchDetailText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const descM = html.match(/<div class=popisdetail>([\s\S]*?)<\/div>/);
    return descM ? cleanText(stripTags(descM[1])) : "";
  } catch {
    return "";
  }
}

async function fetchListPage(url: string): Promise<string> {
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
  return res.text();
}

function parseListPage(html: string, cap: number): Listing[] {
  // Split into listing blocks
  const blockRe = /<div class="inzeraty inzeratyflex">([\s\S]*?)(?=<div class="inzeraty inzeratyflex">|<div class="strankovani)/g;
  const out: Listing[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    if (out.length >= cap) break;
    const block = m[1];
    const badges: string[] = [];
    if (/\btop\b/i.test(block) || /class="[^"]*top[^"]*"/i.test(block)) badges.push("Placené");

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

    const dateM = block.match(/<span class="velikost10">([\s\S]*?)<\/span>/);
    const published_at = dateM ? parseBazosDate(stripTags(dateM[1])) : parseBazosDate(block);

    const descM = block.match(/<div class="popis">([\s\S]*?)<\/div>/);
    const descText = descM ? stripTags(descM[1]) : "";
    const ownership = parseOwnership(title + " " + descText);

    const area_m2 = parseArea(title);

    out.push({
      source: "Bazoš",
      source_key: "bazos",
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
      description_snippet: descText ? descText.slice(0, 600) : undefined,
      invest: null,
      badges: badges.length ? badges : undefined,
    });
  }
  return out;
}

export async function fetchBazos(f: ScanFilters): Promise<Listing[]> {
  const cap = Math.max(1, f.per_source_limit || 20);
  const maxPages = Math.max(1, f.max_pages ?? 1);
  const collected: Listing[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages && collected.length < cap; page++) {
    const html = page === 0
      ? await fetchListPage(buildUrl(f, 0))
      : await fetchListPage(buildUrl(f, page * BAZOS_PAGE_SIZE)).catch(() => "");
    if (!html) break;
    const items = parseListPage(html, cap - collected.length);
    if (!items.length) break;
    let added = 0;
    for (const it of items) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      collected.push(it);
      added++;
    }
    if (added === 0) break;
    if (page < maxPages - 1) await new Promise((res) => setTimeout(res, 300));
  }

  // Ownership detail lookups, 6 at a time so we stay polite on deep runs.
  const queue = collected.map((l, i) => ({ l, i })).filter(j => !j.l.ownership).slice(0, 600);
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        const detailText = await fetchDetailText(job.l.url);
        if (!detailText) continue;
        collected[job.i] = {
          ...job.l,
          ownership: parseOwnership(`${job.l.name} ${detailText}`) ?? job.l.ownership,
          description_snippet: detailText.slice(0, 600),
        };
      }
    }),
  );
  return collected;
}
