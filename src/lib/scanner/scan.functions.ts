import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Diagnostic, Listing, ScanFilters, ScanResult, SourceKey } from "./types";
import { calcYield } from "./valuation";
import { fetchSreality } from "./sources/sreality.server";
import { fetchBazos } from "./sources/bazos.server";
import { fetchBezrealitky } from "./sources/bezrealitky.server";

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
};

const BROWSER_SOURCES: SourceKey[] = ["hyperinzerce", "realitymix", "annonce", "idnes"];

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

export const runScan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FilterSchema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    const filters = data as ScanFilters;
    const tasks: Array<Promise<{ key: SourceKey; results: Listing[]; ms: number; error: string | null; }>> = [];

    for (const src of filters.sources) {
      if (HTTP_FETCHERS[src]) {
        tasks.push(timed(src, () => HTTP_FETCHERS[src]!(filters)));
      } else if (BROWSER_SOURCES.includes(src)) {
        tasks.push(Promise.resolve({
          key: src, results: [], ms: 0,
          error: "Tento zdroj vyžaduje reálný prohlížeč (Playwright). Bude dostupný po napojení Firecrawl ve fázi 2.",
        }));
      }
    }

    const settled = await Promise.all(tasks);
    const diagnostics: Diagnostic[] = [];
    let all: Listing[] = [];
    for (const s of settled) {
      diagnostics.push({
        source: SOURCE_LABEL[s.key],
        key: s.key,
        count: s.results.length,
        ms: s.ms,
        ok: s.error === null,
        error: s.error,
      });
      all = all.concat(s.results);
    }

    // dedup
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
