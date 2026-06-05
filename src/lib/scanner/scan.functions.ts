import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Diagnostic, Listing, PublishedDateSource, ScanFilters, ScanResult, SourceKey } from "./types";
import { calcYield, fallbackOwnership, parseOwnership } from "./valuation";
import { detectAnuity } from "./anuity";
import { applySanity } from "./sanity";
import { getBenchmark } from "./rent-benchmark.server";
import { sortListings } from "./sort";

import { fetchSreality } from "./sources/sreality.server";
import { fetchBezrealitky } from "./sources/bezrealitky.server";
import { fetchBazos } from "./sources/bazos.server";
import { fetchIdnes, fetchRealityMix } from "./sources/firecrawl.server";
import { fetchAnnonce } from "./sources/annonce.server";
import { fetchHyperinzerce } from "./sources/hyperinzerce.server";


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
  sort_by: z.enum(["source", "price_asc", "price_desc", "yield", "date_desc"]),
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

// Whitelist regexů pro „skutečné" URL detailu (ne kategorie / seznam).
const DETAIL_URL_PATTERN: Partial<Record<SourceKey, RegExp>> = {
  sreality: /sreality\.cz\/(detail|hledani)\/.+\/\d+/i,
  bazos: /reality\.bazos\.cz\/inzerat\//i,
  bezrealitky: /bezrealitky\.cz\/nemovitosti-byty-domy\/[^/]+/i,
  annonce: /annonce\.cz\/inzerat\//i,
  hyperinzerce: /hyperinzerce\.cz\/.+\/.+-\d+\.html/i,
  idnes: /reality\.idnes\.cz\/detail\//i,
  realitymix: /realitymix\.cz\/detail\//i,
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

function matchesSubType(l: Listing, sub: ScanFilters["sub_type"]): boolean {
  if (!sub) return true;
  if (l.source_key === "sreality") return true;
  const n = (l.name + " " + l.locality).toLowerCase();
  if (sub === "garazove_stani") return /st[áa]n[íi]/.test(n);
  if (sub === "garaz") return /gar[áa][žz]/.test(n) && !/st[áa]n[íi]/.test(n);
  return true;
}

// Zajistí published_at i published_at_source u každého listingu.
// Současně spočítá per-source breakdown a vyloguje.
function finalizeDates(key: SourceKey, items: Listing[]): { items: Listing[]; breakdown: { api: number; html: number; fallback: number } } {
  const nowIso = new Date().toISOString();
  let api = 0, html = 0, fallback = 0;
  const out = items.map(l => {
    if (l.published_at && l.published_at_source) {
      if (l.published_at_source === "api") api++;
      else if (l.published_at_source === "html") html++;
      else fallback++;
      return l;
    }
    if (l.published_at) {
      // datum doplněno, zdroj neoznačený → považujeme za html/parsed
      html++;
      return { ...l, published_at_source: "html" as PublishedDateSource };
    }
    fallback++;
    return { ...l, published_at: nowIso, published_at_source: "fallback_now" as PublishedDateSource };
  });
  console.log(`[scanner:${key}] dates api=${api} html=${html} fallback=${fallback}`);
  return { items: out, breakdown: { api, html, fallback } };
}

function filterDetailUrls(key: SourceKey, items: Listing[]): { items: Listing[]; dropped: number } {
  const re = DETAIL_URL_PATTERN[key];
  if (!re) return { items, dropped: 0 };
  let dropped = 0;
  const out = items.filter(l => {
    const ok = !!l.url && re.test(l.url);
    if (!ok) dropped++;
    return ok;
  });
  if (dropped > 0) console.log(`[scanner:${key}] dropped ${dropped} listings (URL nematchuje detail regex)`);
  return { items: out, dropped };
}

export const runScan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FilterSchema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    const filters = data as ScanFilters;
    const limit = Math.max(1, Math.min(100, filters.per_source_limit || 20));
    const bench = await getBenchmark();
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
      if (filters.property_type === "ostatni" && filters.sub_type) {
        res = res.filter(r => matchesSubType(r, filters.sub_type));
      }
      const urlFiltered = filterDetailUrls(s.key, res);
      const dated = finalizeDates(s.key, urlFiltered.items);
      const capped = dated.items.slice(0, limit);
      diagnostics.push({
        source: SOURCE_LABEL[s.key],
        key: s.key,
        count: capped.length,
        ms: s.ms,
        ok: s.error === null,
        error: s.error,
        dates_from: dated.breakdown,
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

    const pmin = filters.price_min ?? 0;
    const pmax = filters.price_max ?? 999_999_999;
    all = all
      .map(r => {
        const detected = r.ownership ?? parseOwnership(`${r.name} ${r.locality} ${r.description_snippet || ""}`);
        const ownership = detected ?? fallbackOwnership(filters.deal_type, filters.property_type);
        const ownership_confidence: "high" | "low" = detected ? "high" : "low";
        const anuity = detectAnuity(`${r.name} ${r.description_snippet || ""}`, r.price, ownership);
        const priceForYield = anuity.effective_price ?? r.price;
        return {
          ...r,
          ownership,
          ownership_confidence,
          anuity: anuity.has_anuity ? anuity : undefined,
          invest: calcYield(priceForYield, filters.region, filters.property_type, r.area_m2, r.name, r.locality, ownership, bench),
        };
      })
      .filter(r => r.price === 0 || (r.price >= pmin && r.price <= pmax));

    // Anti-balast: vyřaď zahraniční inzeráty
    const sanity = applySanity(all);
    all = sanity.items;
    if (sanity.stats.filtered_foreign > 0) {
      console.log(`[scanner] filtered ${sanity.stats.filtered_foreign} foreign listings`, sanity.stats.reasons);
    }

    all = sortListings(all, filters.sort_by);
    diagnostics.sort((a, b) => a.source.localeCompare(b.source));

    return {
      count: all.length,
      results: all,
      diagnostics,
      ts: new Date().toISOString(),
      meta: {
        benchmark_fetched_at: bench.fetched_at,
        benchmark_source: bench.source,
        benchmark_live_okresy: bench.live_okresy,
        benchmark_static_okresy: bench.static_okresy,
        filtered_foreign: sanity.stats.filtered_foreign,
        filtered_reasons: sanity.stats.reasons,
      },
    };
  });

