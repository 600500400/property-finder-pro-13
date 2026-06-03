import type { Listing, ScanFilters } from "../types";
import { cleanText, fmtPrice, parseArea } from "../valuation";

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

function fillTemplate(u: string): string {
  return u
    .replace(/\{width\}/g, "800")
    .replace(/\{height\}/g, "600")
    .replace(/\{fileName\}/g, "image-0.jpeg");
}

// Accept only real property photos: hosted on Seznam CDN (sdn.cz) with /c_img_ path,
// or any URL clearly pointing to an estate image file. Reject broker logos.
function isPropertyPhoto(u: string): boolean {
  if (!u || typeof u !== "string") return false;
  if (!/^https?:\/\//.test(u)) return false;
  const low = u.toLowerCase();
  if (/\b(logo|branding|watermark|d_logo_|company|seller|avatar)\b/.test(low)) return false;
  if (low.includes("/c_img_")) return true; // canonical Sreality CDN listing image
  if (low.includes("sdn.cz") && /\.(jpe?g|png|webp|avif)/.test(low)) return true;
  return false;
}

// Look ONLY at known image collections — never crawl whole estate object
// (avoids accidentally picking up broker logos that live elsewhere).
function extractImage(e: any): string {
  const collections: any[] = [
    e._embedded?.images,
    e._links?.images,
    e.images,
  ];
  for (let c of collections) {
    if (!c) continue;
    if (!Array.isArray(c)) c = [c];
    for (const it of c) {
      if (!it) continue;
      let href = "";
      if (typeof it === "string") href = it;
      else if (typeof it === "object") {
        href = it.href || it.url || it.src
          || it._links?.view?.href || it._links?.self?.href
          || it.image_middle || it.image_big || "";
      }
      if (!href) continue;
      const filled = fillTemplate(href);
      if (isPropertyPhoto(filled)) return filled;
    }
  }
  return "";
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

function publishedOf(e: any): string | undefined {
  const cand = e.last_update || e.lastUpdate || e.date || e.created || e.publish_date || e._embedded?.estate?.last_update;
  if (!cand) return undefined;
  const d = new Date(String(cand));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
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
    const area_m2 = parseArea(name) ?? (typeof e.usable_area === "number" ? e.usable_area : undefined);
    out.push({
      source: "Sreality",
      source_key: "sreality",
      name,
      locality: localityOf(e),
      price,
      price_text: price ? fmtPrice(price) : "Cena na vyžádání",
      url,
      img: extractImage(e),
      area: areaM ? areaM[0] : (area_m2 ? `${area_m2} m²` : ""),
      area_m2,
      published_at: publishedOf(e),
      invest: null,
      badges: badgesOf(e),
    });
  }
  return out;
}
