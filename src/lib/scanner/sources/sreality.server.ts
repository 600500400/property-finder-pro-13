import type { Listing, Ownership, ScanFilters } from "../types";
import { cleanText, fmtPrice, parseArea, parseOwnership } from "../valuation";
import { regionFromLocality } from "../kraj-mapping";

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
  jihocesky: 1,
  plzensky: 2,
  karlovarsky: 3,
  ustecky: 4,
  liberecky: 5,
  kralovehradecky: 6,
  pardubicky: 7,
  olomoucky: 8,
  zlinsky: 9,
  praha: 10,
  stredocesky: 11,
  moravskoslezsky: 12,
  vysocina: 13,
  jihomoravsky: 14,
};
const SREALITY_REGION_ID_TO_SLUG: Record<number, string> = Object.fromEntries(
  Object.entries(SREALITY_REGIONS).map(([slug, id]) => [id, slug])
);
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
  // Seznam CDN (sdn.cz) vrací 401 Unauthorized, pokud chybí povolený preset transformace
  if (v.includes("sdn.cz") && !v.includes("?fl=")) {
    v += "?fl=res,1200,1200,1|shr,,20|jpg,80";
  }
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
    const city = loc.city || "";
    const part = loc.citypart || "";
    const cityPart = cleanText(city && part && city !== part ? `${city} – ${part}` : city || part);
    const district = loc.district ? cleanText(loc.district) : "";
    if (
      district &&
      !district.toLowerCase().startsWith("praha") &&
      !district.toLowerCase().startsWith("brno") &&
      !cityPart.toLowerCase().includes(district.toLowerCase())
    ) {
      return cityPart ? `${cityPart}, okres ${district}` : `okres ${district}`;
    }
    return cityPart;
  }
  if (typeof loc === "string") return cleanText(loc);
  return cleanText(e.seo?.locality || "");
}

function krajOf(e: any, detailLoc?: string): string | undefined {
  if (!e) return undefined;
  const loc = e.locality;
  // 1. Check region_seo_name
  const seoReg = String(loc?.region_seo_name || e.region_seo_name || "");
  if (seoReg) {
    const clean = seoReg.replace(/-kraj$/, "").replace(/[^a-z]/g, "");
    if (clean in SREALITY_REGIONS) return clean;
  }
  // 2. Check region string
  if (loc?.region) {
    const fromReg = regionFromLocality(String(loc.region));
    if (fromReg) return fromReg;
  }
  // 3. Check district string
  if (loc?.district) {
    const fromDist = regionFromLocality(`okres ${loc.district}`);
    if (fromDist) return fromDist;
  }
  // 4. Check region_id
  const regId = loc?.region_id ?? e.locality_region_id ?? e.region_id;
  if (typeof regId === "number" && SREALITY_REGION_ID_TO_SLUG[regId]) {
    return SREALITY_REGION_ID_TO_SLUG[regId];
  }
  // 5. Check detailLoc if provided
  if (detailLoc) {
    const fromDetail = regionFromLocality(detailLoc);
    if (fromDetail) return fromDetail;
  }
  return undefined;
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

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fallback sub-segment per main category — Sreality 404s a detail URL without it. */
const SUB_FALLBACK: Record<number, string> = {
  1: "1+kk", 2: "rodinny", 3: "pozemek", 4: "komercni", 5: "ostatni",
};

/**
 * Canonical Sreality detail URL has exactly six segments:
 *   /detail/{prodej|pronajem}/{byt|dum|…}/{subtype}/{locality-slug}/{hash_id}
 * A missing subtype segment 404s; a non-canonical subtype/locality slug 301s to
 * the canonical one, so any non-empty value is safe. Never fall back to
 * /hledani/… — that is a search page and does not open the listing.
 */
function detailUrl(e: any, typeS: string, mainCb: number, name: string): string {
  const hashId = e.hash_id || "";
  const loc = locSlug(e) || "lokalita";
  const mainS = MAIN_SLUG[mainCb] || "ostatni";

  const subName = typeof e.category_sub_cb === "object" ? e.category_sub_cb?.name : e.category_sub_cb;
  let sub = typeof subName === "string" ? slugify(subName) : "";

  if (!sub && (mainCb === 1 || mainCb === 2)) sub = dispSlug(name);
  if (!sub && mainCb === 5) {
    const low = name.toLowerCase();
    if (low.includes("stání") || low.includes("stani")) sub = "garazove-stani";
    else if (low.includes("garáž") || low.includes("garaz")) sub = "garaz";
  }
  if (!sub) sub = SUB_FALLBACK[mainCb] || "ostatni";

  return `https://www.sreality.cz/detail/${typeS}/${mainS}/${sub}/${loc}/${hashId}`;
}

/** Sreality titles spell out the plot: "Prodej rodinného domu 116 m², pozemek 612 m²". */
function landFromName(name: string): number | undefined {
  const m = name.match(/pozemek\s+([\d\s\u00a0]+)\s*m[²2]/i);
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

async function detailInfo(hashId: string | number | undefined, headers: HeadersInit): Promise<{ ownership?: Ownership; description?: string; land_area_m2?: number; locality?: string; kraj?: string }> {
  if (!hashId) return {};
  try {
    const r = await fetch(`https://www.sreality.cz/api/v1/estates/${hashId}`, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return {};
    const data: any = await r.json();
    const result = data.result || data;
    const description = cleanText(result.advert_description || result.description || "");
    const detailLocality = result.locality;
    const locality = detailLocality && typeof detailLocality === "object"
      ? cleanText([
          detailLocality.city,
          detailLocality.citypart && detailLocality.citypart !== detailLocality.city ? detailLocality.citypart : null,
          detailLocality.district ? `okres ${detailLocality.district}` : null,
          detailLocality.region,
        ].filter(Boolean).join(", "))
      : undefined;
    return {
      ownership: ownershipFromValue(result.ownership) ?? parseOwnership(description),
      description,
      land_area_m2: landAreaOf(result),
      locality,
      kraj: krajOf(result, locality),
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
  const maxPages = Math.max(1, f.max_pages ?? 1);
  const wanted = perPage * maxPages;

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

  const estates: any[] = [];
  let lastStatus: number | null = null;
  let workingEp: string | null = null;
  const seenHash = new Set<string>();

  // Walk listing pages until max_pages is reached or the portal stops adding rows.
  for (let page = 0; page < maxPages && estates.length < wanted; page++) {
    let pageEstates: any[] = [];
    const eps: string[] = workingEp ? [workingEp] : endpoints;
    for (const ep of eps) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
      qs.set("page", String(page + 1));
      qs.set("offset", String(page * perPage));
      try {
        const r = await fetch(`${ep}?${qs}`, { headers, signal: AbortSignal.timeout(15000) });
        lastStatus = r.status;
        if (!r.ok) continue;
        const data: any = await r.json();
        const est = data.results || data._embedded?.estates || data.estates || data.data || [];
        if (Array.isArray(est) && est.length) { pageEstates = est; workingEp = ep; break; }
      } catch {
        // try next endpoint
      }
    }
    if (!pageEstates.length) break;
    let added = 0;
    for (const e of pageEstates) {
      const h = String(e?.hash_id ?? "");
      if (h) {
        if (seenHash.has(h)) continue;
        seenHash.add(h);
      }
      estates.push(e);
      added++;
    }
    if (added === 0 || pageEstates.length < perPage) break;
    if (page < maxPages - 1) await new Promise((res) => setTimeout(res, 250));
  }

  if (!estates.length) {
    throw new Error(`Sreality nevrátila inzeráty (HTTP ${lastStatus ?? "n/a"}).`);
  }

  const typeS = TYPE_SLUG[typeCb] || "prodej";
  const isHouses = f.property_type === "domy";
  // Detail calls are rate-limit sensitive: run them 8 at a time and cap the total.
  // For houses, title & search payload already guarantee plot size, floor area, locality & subtype,
  // so we skip detail calls entirely. This boosts speed 10x and enables deep pagination without timeouts.
  const DETAIL_CAP = isHouses ? 0 : 500;
  const details: Array<Awaited<ReturnType<typeof detailInfo>>> = new Array(estates.length).fill({});
  if (DETAIL_CAP > 0) {
    const queue = estates.slice(0, DETAIL_CAP).map((e, i) => ({ e, i }));
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (;;) {
          const job = queue.shift();
          if (!job) return;
          details[job.i] = await detailInfo(job.e?.hash_id, headers);
        }
      }),
    );
  }
  const out: Listing[] = [];
  let withImg = 0;
  for (const [idx, e] of estates.entries()) {
    if (!e || typeof e !== "object") continue;
    const price = priceOf(e);
    const name = cleanText(e.advert_name || e.name || "Nemovitost");
    const url = detailUrl(e, typeS, mainCb, name);
    const areaM = name.match(/(\d+)\s*m[²2]/i);
    const area_m2 = parseArea(name) ?? (typeof e.usable_area === "number" ? e.usable_area : undefined);
    const img = extractImage(e);
    if (img) withImg++;
    const pubIso = publishedOf(e);
    const loc = details[idx]?.locality ?? localityOf(e);
    const kraj = details[idx]?.kraj ?? krajOf(e, loc);
    const land_area_m2 = (typeof e.estate_area === "number" && e.estate_area > 0 ? e.estate_area : undefined)
      ?? (typeof e.land_area === "number" && e.land_area > 0 ? e.land_area : undefined)
      ?? details[idx]?.land_area_m2
      ?? landFromName(name);

    out.push({
      source: "Sreality",
      source_key: "sreality",
      name,
      locality: loc,
      kraj,
      price,
      price_text: price ? fmtPrice(price) : "Cena na vyžádání",
      url,
      img,
      area: areaM ? areaM[0] : (area_m2 ? `${area_m2} m²` : ""),
      area_m2,
      land_area_m2,
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
