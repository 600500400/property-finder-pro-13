import type { Listing, ScanFilters } from "../types";
import { cleanText, fmtPrice, parsePrice } from "../valuation";

const SREALITY_CATEGORY_MAIN: Record<string, number> = {
  byty: 1, domy: 2, pozemky: 3, komercni: 4, ostatni: 5,
};
const SREALITY_CATEGORY_TYPE: Record<string, number> = {
  prodej: 1, pronajem: 2,
};
const SREALITY_CATEGORY_SUB: Record<string, number> = {
  garaz: 34, garazove_stani: 52,
};
const SREALITY_REGIONS: Record<string, number> = {
  praha: 10, stredocesky: 11, jihocesky: 1, jihomoravsky: 2, karlovarsky: 3,
  kralovehradecky: 4, liberecky: 5, moravskoslezsky: 6, olomoucky: 7,
  pardubicky: 8, plzensky: 9, ustecky: 12, vysocina: 13, zlinsky: 14,
};
const SREALITY_COUNTRY_CZ = 112;
const MAIN_SLUG: Record<number, string> = {
  1: "byt", 2: "dum", 3: "pozemek", 4: "komercni", 5: "ostatni",
};
const TYPE_SLUG: Record<number, string> = { 1: "prodej", 2: "pronajem" };

function fixImg(u: string): string {
  return (u || "")
    .replace(/\{width\}/g, "400")
    .replace(/\{height\}/g, "300")
    .replace(/\{fileName\}/g, "image-0.jpeg");
}

function isImgUrl(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  if (!/^https?:\/\//.test(s)) return false;
  if (s.includes("sdn.cz") || s.includes("szn.cz") || s.includes("sreality.cz") || s.includes("imgsr")) return true;
  return /\.(jpe?g|png|webp|avif)(\?|$)/i.test(s);
}

function extractImage(e: any): string {
  // Try documented link/embedded shapes first
  const candidates: any[] = [
    e._links?.images,
    e._embedded?.images,
    e.images,
    e._links?.image_middle,
    e._links?.image_middle2,
    e._links?.image_big,
    e._links?.gallery,
    e.gallery,
  ];

  for (let src of candidates) {
    if (!src) continue;
    if (src && typeof src === "object" && !Array.isArray(src)) src = [src];
    if (Array.isArray(src)) {
      for (const it of src) {
        if (!it) continue;
        if (typeof it === "string" && isImgUrl(it)) return fixImg(it);
        if (typeof it === "object") {
          const href = it.href || it.url || it.src || it._links?.self?.href;
          if (typeof href === "string" && href) {
            const fixed = fixImg(href);
            if (isImgUrl(fixed)) return fixed;
          }
        }
      }
    }
  }

  // Recursive walk fallback
  let found = "";
  const walk = (n: any, depth = 0) => {
    if (found || depth > 6) return;
    if (Array.isArray(n)) n.forEach((x) => walk(x, depth + 1));
    else if (n && typeof n === "object") Object.values(n).forEach((x) => walk(x, depth + 1));
    else if (typeof n === "string") {
      const fixed = fixImg(n);
      if (isImgUrl(fixed)) found = fixed;
    }
  };
  walk(e);
  return found;
}

function localityOf(e: any): string {
  const loc = e.locality;
  if (loc && typeof loc === "object") {
    const city = loc.city || ""; const part = loc.citypart || "";
    return cleanText(city && part ? `${city} – ${part}` : city || part);
  }
  if (typeof loc === "string") return cleanText(loc);
  return cleanText(e.seo?.locality || "");
}

function locSlug(e: any): string {
  const loc = e.locality;
  if (loc && typeof loc === "object") {
    const parts = [loc.city_seo_name, loc.citypart_seo_name].filter(Boolean);
    if (parts.length) return parts.join("-");
  }
  return e.seo?.locality || "lokalita";
}

function dispSlug(name: string): string {
  const m = name.match(/(\d\+(?:kk|\d))/i);
  return m ? m[1].toLowerCase() : "";
}

function detailUrl(e: any, typeS: string, mainCb: number, name: string): string {
  const hashId = e.hash_id || "";
  const loc = locSlug(e);

  const self = e._links?.self?.href || e._links?.self;
  if (typeof self === "string" && self.includes("/detail/")) {
    return self.startsWith("http") ? self : `https://www.sreality.cz${self}`;
  }

  if (mainCb === 5) {
    const low = name.toLowerCase();
    if (low.includes("stání") || low.includes("stani"))
      return `https://www.sreality.cz/detail/${typeS}/ostatni/garazove-stani/${loc}/${hashId}`;
    if (low.includes("garáž") || low.includes("garaz"))
      return `https://www.sreality.cz/detail/${typeS}/ostatni/garaz/${loc}/${hashId}`;
    return `https://www.sreality.cz/detail/${typeS}/ostatni/${loc}/${hashId}`;
  }
  const mainS = MAIN_SLUG[mainCb] || "ostatni";
  const disp = (mainCb === 1 || mainCb === 2) ? dispSlug(name) : "";
  if (disp) return `https://www.sreality.cz/detail/${typeS}/${mainS}/${disp}/${loc}/${hashId}`;
  if (hashId) return `https://www.sreality.cz/hledani/${typeS}/${mainS}?id=${hashId}`;
  return `https://www.sreality.cz/detail/${typeS}/${mainS}/${loc}/${hashId}`;
}

function priceOf(e: any): number {
  for (const key of ["price_czk", "price", "price_summary"]) {
    const v = e[key];
    if (v && typeof v === "object") {
      const raw = v.value_raw ?? v.value;
      if (raw) { const n = parseInt(String(raw), 10); if (!isNaN(n)) return n; }
    } else if (typeof v === "number" && v > 0) return Math.floor(v);
  }
  return 0;
}

function badgesOf(e: any): string[] {
  const out: string[] = [];
  if (e.is_topped || e.label_top || e.labelsAll?.includes?.("topped") || e.labels?.includes?.("topped")) out.push("TOP");
  if (e.mark_as_new || e.is_new || e.labels?.includes?.("new")) out.push("NOVÝ");
  return out;
}

export async function fetchSreality(f: ScanFilters): Promise<Listing[]> {
  const mainCb = SREALITY_CATEGORY_MAIN[f.property_type] ?? 5;
  const typeCb = SREALITY_CATEGORY_TYPE[f.deal_type] ?? 1;
  const perPage = Math.max(20, Math.min(100, f.per_source_limit || 60));

  const params: Record<string, string | number> = {
    category_main_cb: mainCb,
    category_type_cb: typeCb,
    per_page: perPage,
    limit: perPage,
    offset: 0,
    sort: 0,
  };
  if (mainCb === 5 && f.sub_type && SREALITY_CATEGORY_SUB[f.sub_type] !== undefined) {
    params.category_sub_cb = SREALITY_CATEGORY_SUB[f.sub_type];
  }
  if (f.region && SREALITY_REGIONS[f.region] !== undefined) {
    params.locality_region_id = SREALITY_REGIONS[f.region];
  } else {
    params.locality_country_id = SREALITY_COUNTRY_CZ;
  }
  if (f.price_min) params.czk_price_summary_order2 = `${f.price_min}|${f.price_max || 99999999}`;

  const endpoints = [
    "https://www.sreality.cz/api/v1/estates/search",
    "https://www.sreality.cz/api/cs/v2/estates",
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
    "Referer": "https://www.sreality.cz/hledani/byty",
  };

  let estates: any[] = [];
  let lastStatus: number | null = null;

  for (const ep of endpoints) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    try {
      const r = await fetch(`${ep}?${qs}`, { headers, signal: AbortSignal.timeout(15000) });
      lastStatus = r.status;
      if (!r.ok) continue;
      const data: any = await r.json();
      const est = data._embedded?.estates || data.results || data.estates || data.data || [];
      if (Array.isArray(est) && est.length) { estates = est; break; }
    } catch {
      // try next
    }
  }

  if (!estates.length) {
    throw new Error(`Sreality nevrátila inzeráty (HTTP ${lastStatus ?? "n/a"}). Pravděpodobně blokace bez TLS fingerprintu.`);
  }

  const typeS = TYPE_SLUG[typeCb] || "prodej";
  const out: Listing[] = [];
  for (const e of estates) {
    if (!e || typeof e !== "object") continue;
    const price = priceOf(e);
    const name = cleanText(e.advert_name || e.name || "Nemovitost");
    const url = detailUrl(e, typeS, mainCb, name);
    const areaM = name.match(/(\d+)\s*m²/);
    out.push({
      source: "Sreality",
      source_key: "sreality",
      name,
      locality: localityOf(e),
      price,
      price_text: price ? fmtPrice(price) : "Cena na vyžádání",
      url,
      img: extractImage(e),
      area: areaM ? areaM[0] : "",
      invest: null,
      badges: badgesOf(e),
    });
  }
  return out;
}
