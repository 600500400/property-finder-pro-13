import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Diagnostic, Listing, ScanFilters, ScanResult, SourceKey } from "./types";
import { calcYield } from "./valuation";
import { fetchSreality } from "./sources/sreality.server";
import { fetchBezrealitky } from "./sources/bezrealitky.server";
import { fetchBazos } from "./sources/bazos.server";
import { fetchIdnes, fetchRealityMix, fetchAnnonce, fetchHyperinzerce } from "./sources/firecrawl.server";


const FilterSchema = z.object({
  deal_type: z.enum(["prodej", "pronajem"]),
  property_type: z.enum(["ostatni", "byty", "domy", "pozemky", "komercni"]),
  sub_type: z.enum(["garaz", "garazove_stani", ""]),
  region: z.enum([
    "", "praha", "stredocesky", "jihocesky", "jihomoravsky", "karlovarsky",
    "kralovehradecky", "liberecky", "moravskoslezsky", "olomoucky",
    "pardubicky", "plzensky", "ustecky", "vysocina", "zlinsky",
  ]),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  sources: z.array(z.enum([
    "sreality", "bazos", "bezrealitky", "hyperinzerce", "realitymix", "annonce", "idnes",
  ])),
  sort_by: z.enum(["source", "price_asc", "price_desc", "yield"]),
  per_source_limit: z.number().min(1).max(100).default(20),
});

const SOURCE_LABEL: Record<SourceKey, string> = {
  sreality: "Sreality",
  bazos: "Bazoš",
  bezrealitky: "Bezrealitky",
  hyperinzerce: "Hyperinzerce",
  realitymix: "RealityMix",
  annonce: "Annonce",
  idnes: "iDnes Reality",
};

const HTTP_FETCHERS: Partial<Record<SourceKey, (f: ScanFilters) => Promise<Listing[]>>> = {
  sreality: fetchSreality,
  bazos: fetchBazos,
  bezrealitky: fetchBezrealitky,
  idnes: fetchIdnes,
  realitymix: fetchRealityMix,
  annonce: fetchAnnonce,
  hyperinzerce: fetchHyperinzerce,
};

async function timed(key: SourceKey, fn: () => Promise<Listing[]>): Promise<{
  key: SourceKey; results: Listing[]; ms: number; error: string | null;
}> {
  const t0 = Date.now();
  try {
    const res = await fn();
    return { key, results: res || [], ms: Date.now() - t0, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { key, results: [], ms: Date.now() - t0, error: msg.slice(0, 240) };
  }
}

// Post-filter by sub_type (garaz vs. garazove_stani) for sources that don't differentiate.
function matchesSubType(l: Listing, sub: ScanFilters["sub_type"]): boolean {
  if (!sub) return true;
  // Sreality already filters server-side via category_sub_cb
  if (l.source_key === "sreality") return true;
  const n = (l.name + " " + l.locality).toLowerCase();
  if (sub === "garazove_stani") {
    return /st[áa]n[íi]/.test(n);
  }
  if (sub === "garaz") {
    // accept gar[áa]ž but exclude explicit "stání"
    return /gar[áa][žz]/.test(n) && !/st[áa]n[íi]/.test(n);
  }
  return true;
}

export const runScan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FilterSchema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    const filters = data as ScanFilters;
    const limit = Math.max(1, Math.min(100, filters.per_source_limit || 20));
    const tasks: Array<Promise<{ key: SourceKey; results: Listing[]; ms: number; error: string | null; }>> = [];

    for (const src of filters.sources) {
      if (HTTP_FETCHERS[src]) {
        tasks.push(timed(src, () => HTTP_FETCHERS[src]!(filters)));
      }
    }

    const settled = await Promise.all(tasks);
    const diagnostics: Diagnostic[] = [];
    let all: Listing[] = [];
    for (const s of settled) {
      let res = s.results;
      // sub_type post-filter for property_type "ostatni"
      if (filters.property_type === "ostatni" && filters.sub_type) {
        res = res.filter(r => matchesSubType(r, filters.sub_type));
      }
      const capped = res.slice(0, limit);
      diagnostics.push({
        source: SOURCE_LABEL[s.key],
        key: s.key,
        count: capped.length,
        ms: s.ms,
        ok: s.error === null,
        error: s.error,
      });
      all = all.concat(capped);
    }

    // dedup by URL
    const seen = new Set<string>();
    all = all.filter(r => {
      const k = r.url || `${r.source}|${r.name}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // price filter + invest calc
    const pmin = filters.price_min ?? 0;
    const pmax = filters.price_max ?? 999_999_999;
    all = all
      .map(r => ({ ...r, invest: calcYield(r.price, filters.region, filters.property_type) }))
      .filter(r => r.price === 0 || (r.price >= pmin && r.price <= pmax));

    // sort
    switch (filters.sort_by) {
      case "price_asc": all.sort((a, b) => (a.price || 999999999) - (b.price || 999999999)); break;
      case "price_desc": all.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case "yield": all.sort((a, b) => (b.invest?.net_yield || 0) - (a.invest?.net_yield || 0)); break;
      default: all.sort((a, b) => a.source.localeCompare(b.source)); break;
    }
    diagnostics.sort((a, b) => a.source.localeCompare(b.source));

    return {
      count: all.length,
      results: all,
      diagnostics,
      ts: new Date().toISOString(),
    };
  });
