import type { Listing, Ownership, ScanFilters } from "../types";
import { cleanText, fmtPrice, parseOwnership } from "../valuation";


const GQL = "https://api.bezrealitky.cz/graphql/";
const OFFER: Record<string, string> = { prodej: "PRODEJ", pronajem: "PRONAJEM" };
// Valid EstateType enum (introspected 2026-06): BYT, DUM, POZEMEK, GARAZ, KANCELAR, NEBYTOVY_PROSTOR, REKREACNI_OBJEKT
const ESTATE: Record<string, string> = {
  byty: "BYT", domy: "DUM", pozemky: "POZEMEK", komercni: "KANCELAR", ostatni: "GARAZ",
};

const BASE_FIELDS = "id uri offerType estateType disposition price surface address(locale: CS) tenure";
const DATE_VARIANTS = ["dateCreated", "publishedAt", "createdAt", "lastUpdate", ""];
const IMG_VARIANTS = [
  "mainImage { url(filter: RECORD_MAIN) }",
  "mainImage { url }",
  "images { url(filter: RECORD_MAIN) }",
  "images { url }",
  "",
];

function buildQueries(imgFragment: string, dateField: string) {
  const fields = BASE_FIELDS
    + (dateField ? " " + dateField : "")
    + (imgFragment ? " " + imgFragment : "");
  const body = "{ list{ " + fields + " } totalCount }";
  const region = `query($offerType:[OfferType],$estateType:[EstateType],$regionOsmIds:[ID],$limit:Int,$order:ResultOrder){ listAdverts(offerType:$offerType,estateType:$estateType,regionOsmIds:$regionOsmIds,limit:$limit,order:$order) ${body} }`;
  const plain = `query($offerType:[OfferType],$estateType:[EstateType],$limit:Int,$order:ResultOrder){ listAdverts(offerType:$offerType,estateType:$estateType,limit:$limit,order:$order) ${body} }`;
  return { region, plain };
}

function isFieldError(errs: any): boolean {
  const msg = JSON.stringify(errs || []).toLowerCase();
  return ["cannot query field", "unknown argument", "unknown field", "did you mean", "enum", "filter", "must have a selection"]
    .some(k => msg.includes(k));
}

function dispOf(d: string | null | undefined): string {
  d = (d || "").trim();
  if (!d.startsWith("DISP_")) return d;
  const p = d.slice(5).split("_");
  const a = p[0];
  if (p.length > 1) return `${a}+${p[1].toUpperCase() === "KK" ? "kk" : p[1]}`;
  return a;
}

function imgOf(it: any): string {
  const mi = it.mainImage || it.previewImg || it.image;
  if (mi && typeof mi === "object") {
    let u = mi.url || mi.src;
    if (Array.isArray(u)) u = u[0] || "";
    if (u) return u.startsWith("http") ? u : `https://www.bezrealitky.cz${u}`;
  }
  const imgs = it.images;
  if (Array.isArray(imgs) && imgs.length && typeof imgs[0] === "object") {
    const u = imgs[0].url || imgs[0].src;
    if (u) return u.startsWith("http") ? u : `https://www.bezrealitky.cz${u}`;
  }
  return "";
}

function addrToStr(addr: any): string {
  if (typeof addr === "string") return cleanText(addr);
  if (addr && typeof addr === "object") {
    const parts = [addr.streetAddress, addr.addressLocality, addr.postalCode, addr.addressRegion].filter(Boolean);
    return cleanText(parts.join(" "));
  }
  return "";
}

export async function fetchBezrealitky(f: ScanFilters): Promise<Listing[]> {
  const baseVars: any = {
    offerType: [OFFER[f.deal_type] || "PRODEJ"],
    estateType: [ESTATE[f.property_type] || "BYT"],
    limit: Math.max(1, Math.min(100, f.per_source_limit || 20)),
    order: "TIMEORDER_DESC",
  };
  const regionVars = { ...baseVars, regionOsmIds: ["R51684"] };

  async function run(query: string, variables: any): Promise<any> {
    const r = await fetch(GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.bezrealitky.cz",
        "Referer": "https://www.bezrealitky.cz/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Bezrealitky HTTP ${r.status}`);
    return r.json();
  }

  let payload: any = null;
  let firstErr: any = null;
  for (const frag of IMG_VARIANTS) {
    const { region, plain } = buildQueries(frag);
    let p = await run(region, regionVars);
    if (p.errors && frag && isFieldError(p.errors)) { firstErr ||= p.errors; continue; }
    if (p.errors) p = await run(plain, baseVars);
    if (!p.errors) { payload = p; break; }
    firstErr ||= p.errors;
  }
  if (!payload) throw new Error(`GraphQL: ${JSON.stringify((firstErr || [])[0] || {}).slice(0, 160)}`);

  const lst = payload.data?.listAdverts?.list || [];
  const out: Listing[] = [];
  for (const it of lst) {
    const price = it.price || 0;
    const uri = it.uri || "";
    const url = uri ? `https://www.bezrealitky.cz/nemovitosti-byty-domy/${uri}` : "https://www.bezrealitky.cz/vyhledat";
    const surface = it.surface;
    const disp = dispOf(it.disposition);
    const title = [disp, surface ? `${surface} m²` : ""].filter(Boolean).join(" ") || "Inzerát Bezrealitky";
    let published_at: string | undefined;
    if (it.dateCreated) {
      const d = new Date(String(it.dateCreated));
      if (!isNaN(d.getTime())) published_at = d.toISOString();
    }
    out.push({
      source: "Bezrealitky",
      source_key: "bezrealitky",
      name: cleanText(title),
      locality: addrToStr(it.address),
      price,
      price_text: fmtPrice(price),
      url,
      img: imgOf(it),
      area: surface ? `${surface} m²` : "",
      area_m2: typeof surface === "number" ? surface : undefined,
      published_at,
      invest: null,
    });
  }
  return out;
}
