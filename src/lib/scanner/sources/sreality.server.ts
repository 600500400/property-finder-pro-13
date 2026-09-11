import type { Listing, Ownership, ScanFilters } from "../types";
import { cleanText, fmtPrice, parseArea, parseOwnership } from "../valuation";

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

function normalizeImgUrl(u: string): string {
  if (!u) return "";
  let v = u.trim();
  if (v.startsWith("//")) v = "https:" + v;
  // Sreality občas vrací template "{width}/{height}"; necháme rozumné rozměry
  v = v.replace(/\{width\}/g, "800").replace(/\{height\}/g, "600");
  return v;
}

function isPropertyPhoto(u: string): boolean {
  if (!u) return false;
  const low = u.toLowerCase();
  if (/(logo|branding|d_logo_|premise_logo)/.test(low)) return false;
  // c_img_ je canonical Sreality CDN listing image
  if (low.includes("/c_img_")) return true;
  if (low.includes("sdn.cz") && /\.(jpe?g|png|webp|avif)/.test(low)) return true;
  return false;
}

// Sreality v1 search API ukládá obrázky v `advert_images` (string[])
// a `advert_images_all` (object[] s `advert_image_sdn_url`).
function extractImage(e: any): string {
  const candidates: string[] = [];

  if (Array.isArray(e.advert_images)) {
    for (const u of e.advert_images) {
      if (typeof u === "string") candidates.push(u);
    }
  }
  if (Array.isArray(e.advert_images_all)) {
    for (const it of e.advert_images_all) {
      const u = it?.advert_image_sdn_url || it?.url || it?.href;
      if (typeof u === "string") candidates.push(u);
    }
  }
  // legacy fallback
  const legacy: any[] = [e._embedded?.images, e._links?.images, e.images];
  for (let c of legacy) {
    if (!c) continue;
    if (!Array.isArray(c)) c = [c];
    for (const it of c) {
      if (!it) continue;
      const u = typeof it === "string" ? it
        : it.href || it.url || it.src || it.image_middle || it.image_big || "";
      if (u) candidates.push(u);
    }
  }

  for (const raw of candidates) {
    const u = normalizeImgUrl(raw);
    if (isPropertyPhoto(u)) return u;
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

/** Sreality titles spell out the plot: "Prodej rodinného domu 116 m², pozemek 612 m²". */
function landFromName(name: string): number | undefined {
  const m = name.match(/pozemek\s+([\d\s\u00a0]+)\s*m²/i);
  if (!m) return undefined;
  const n = parseInt(m[1].replace(/[^\d]/g, ""), 10);
  return isNaN(n) || n <= 0 ? undefined : n;
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
  if (e.is_topped || e.label_top || e.labelsAll?.includes?.("topped") || e.labels?.includes?.("topped")) out.push("Placené");
  if (e.mark_as_new || e.is_new) out.push("NOVÝ");
  return out;
}

function publishedOf(e: any): string | undefined {
  const cand = e.last_update || e.lastUpdate || e.date || e.created || e.publish_date
    || e.last_modified || e.modified || e.created_at;
  if (!cand) return undefined;
  const d = new Date(String(cand));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function ownershipFromValue(raw: any): Ownership | undefined {
  const v = raw?.value ?? raw;
  const name = typeof raw?.name === "string" ? raw.name.toLowerCase() : "";
  if (v === 1 || name.includes("osob")) return "osobni";
  if (v === 2 || name.includes("druž") || name.includes("druz")) return "druzstevni";
  if (v === 3 || name.includes("stát") || name.includes("stat") || name.includes("obec")) return "jine";
  return undefined;
}

/** Plocha pozemku / parcely from the detail payload (houses & land only). */
function landAreaOf(result: any): number | undefined {
  const direct = result?.land_area ?? result?.plot_area ?? result?.garden_area;
  if (typeof direct === "number" && direct > 0) return direct;
  const items = result?.items;
  if (Array.isArray(items)) {
    for (const it of items) {
      const nm = String(it?.name || "").toLowerCase();
      if (nm.includes("plocha pozemku") || nm.includes("plocha parcely") || nm.includes("pozemek")) {
        const raw = it?.value;
        const n = typeof raw === "number" ? raw : parseInt(String(raw).replace(/[^\d]/g, ""), 10);
        if (!isNaN(n) && n > 0) return n;
      }
    }
  }
  return undefined;
}

async function detailInfo(hashId: string | number | undefined, headers: HeadersInit): Promise<{ ownership?: Ownership; description?: string; land_area_m2?: number }> {
  if (!hashId) return {};
  try {
    const r = await fetch(`https://www.sreality.cz/api/v1/estates/${hashId}`, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return {};
    const data: any = await r.json();
    const result = data.result || data;
    const description = cleanText(result.advert_description || result.description || "");
    return {
      ownership: ownershipFromValue(result.ownership) ?? parseOwnership(description),
      description,
      land_area_m2: landAreaOf(result),
    };
  } catch {
    return {};
  }
}

function ownershipOf(e: any, name: string): Ownership | undefined {
  // Sreality: search občas pole nemá; detail má `ownership` { name, value }.
  const direct = ownershipFromValue(e.ownership ?? e.ownership_cb);
  if (direct) return direct;
  return parseOwnership(name);
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
      const est = data.results || data._embedded?.estates || data.estates || data.data || [];
      if (Array.isArray(est) && est.length) { estates = est; break; }
    } catch {
      // try next
    }
  }

  if (!estates.length) {
    throw new Error(`Sreality nevrátila inzeráty (HTTP ${lastStatus ?? "n/a"}).`);
  }

  const typeS = TYPE_SLUG[typeCb] || "prodej";
  const details = await Promise.all(estates.map(e => detailInfo(e?.hash_id, headers)));
  const out: Listing[] = [];
  let withImg = 0;
  for (const [idx, e] of estates.entries()) {
    if (!e || typeof e !== "object") continue;
    const price = priceOf(e);
    const name = cleanText(e.advert_name || e.name || "Nemovitost");
    const url = detailUrl(e, typeS, mainCb, name);
    const areaM = name.match(/(\d+)\s*m²/);
    const area_m2 = parseArea(name) ?? (typeof e.usable_area === "number" ? e.usable_area : undefined);
    const img = extractImage(e);
    if (img) withImg++;
    const pubIso = publishedOf(e);
    out.push({
      source: "Sreality",
      source_key: "sreality",
      name,
      locality: localityOf(e),
      price,
      price_text: price ? fmtPrice(price) : "Cena na vyžádání",
      url,
      img,
      area: areaM ? areaM[0] : (area_m2 ? `${area_m2} m²` : ""),
      area_m2,
      land_area_m2: details[idx]?.land_area_m2 ?? landFromName(name),
      published_at: pubIso,
      published_at_source: pubIso ? "api" : undefined,
      ownership: details[idx]?.ownership ?? ownershipOf(e, name),
      description_snippet: details[idx]?.description ? details[idx].description.slice(0, 600) : undefined,
      invest: null,
      badges: badgesOf(e),
    });
  }
  console.log(`[scanner:sreality] estates=${estates.length} withImg=${withImg}`);
  return out;
}
