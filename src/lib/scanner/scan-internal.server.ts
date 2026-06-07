// Server-only orchestrace skenu — sdílená mezi runScan serverFn a cron endpointem.
import type { Diagnostic, Listing, PublishedDateSource, ScanFilters, ScanResult, SourceKey } from "./types";
import { calcYield } from "./valuation";
import { resolveOwnership } from "./ownership";
import { applySanity } from "./sanity";
import { getBenchmark } from "./rent-benchmark.server";
import { sortListings } from "./sort";

import { fetchSreality } from "./sources/sreality.server";
import { fetchBezrealitky } from "./sources/bezrealitky.server";
import { fetchBazos } from "./sources/bazos.server";
import { fetchIdnes, fetchRealityMix } from "./sources/firecrawl.server";
import { fetchAnnonce } from "./sources/annonce.server";
import { fetchHyperinzerce } from "./sources/hyperinzerce.server";

const SOURCE_LABEL: Record<SourceKey, string> = {
  sreality: "Sreality", bazos: "Bazoš", bezrealitky: "Bezrealitky",
  hyperinzerce: "Hyperinzerce", realitymix: "RealityMix",
  annonce: "Annonce", idnes: "iDnes Reality",
};

const HTTP_FETCHERS: Partial<Record<SourceKey, (f: ScanFilters) => Promise<Listing[]>>> = {
  sreality: fetchSreality, bazos: fetchBazos, bezrealitky: fetchBezrealitky,
  idnes: fetchIdnes, realitymix: fetchRealityMix, annonce: fetchAnnonce,
  hyperinzerce: fetchHyperinzerce,
};

const DETAIL_URL_PATTERN: Partial<Record<SourceKey, RegExp>> = {
  sreality: /sreality\.cz\/(?:detail\/.+\/\d+|hledani\/[^?]+\?id=\d+)/i,
  bazos: /reality\.bazos\.cz\/inzerat\//i,
  bezrealitky: /bezrealitky\.cz\/nemovitosti-byty-domy\/[^/]+/i,
  annonce: /annonce\.cz\/inzerat\//i,
  hyperinzerce: /hyperinzerce\.cz\/.+\/inzerat\/\d+/i,
  idnes: /reality\.idnes\.cz\/detail\//i,
  realitymix: /realitymix\.cz\/detail\//i,
};

async function timed(key: SourceKey, fn: () => Promise<Listing[]>) {
  const t0 = Date.now();
  try {
    const res = await fn();
    return { key, results: res || [], ms: Date.now() - t0, error: null as string | null };
  } catch (e) {
    return { key, results: [], ms: Date.now() - t0, error: (e instanceof Error ? e.message : String(e)).slice(0, 240) };
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

function finalizeDates(key: SourceKey, items: Listing[]) {
  const nowIso = new Date().toISOString();
  let api = 0, html = 0, fallback = 0;
  const out = items.map(l => {
    if (l.published_at && l.published_at_source) {
      if (l.published_at_source === "api") api++;
      else if (l.published_at_source === "html") html++;
      else fallback++;
      return l;
    }
    if (l.published_at) { html++; return { ...l, published_at_source: "html" as PublishedDateSource }; }
    fallback++;
    return { ...l, published_at: nowIso, published_at_source: "fallback_now" as PublishedDateSource };
  });
  console.log(`[scanner:${key}] dates api=${api} html=${html} fallback=${fallback}`);
  return { items: out, breakdown: { api, html, fallback } };
}

function filterDetailUrls(key: SourceKey, items: Listing[]) {
  const re = DETAIL_URL_PATTERN[key];
  if (!re) return { items, dropped: 0 };
  let dropped = 0;
  const out = items.filter(l => {
    const ok = !!l.url && re.test(l.url);
    if (!ok) dropped++;
    return ok;
  });
  if (dropped > 0) console.log(`[scanner:${key}] dropped ${dropped} URLs`);
  return { items: out, dropped };
}

export async function executeScan(filters: ScanFilters): Promise<ScanResult> {
  const limit = Math.max(1, Math.min(100, filters.per_source_limit || 20));
  const bench = await getBenchmark();
  const tasks: Array<ReturnType<typeof timed>> = [];

  for (const src of filters.sources) {
    if (HTTP_FETCHERS[src]) tasks.push(timed(src, () => HTTP_FETCHERS[src]!(filters)));
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
      source: SOURCE_LABEL[s.key], key: s.key, count: capped.length,
      ms: s.ms, ok: s.error === null, error: s.error, dates_from: dated.breakdown,
    });
    all = all.concat(capped);
  }

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
      const res = resolveOwnership(r, filters);
      return {
        ...r,
        ownership: res.ownership,
        ownership_confidence: res.ownership_confidence,
        anuity: res.anuity,
        invest: calcYield(res.priceForYield, filters.region, filters.property_type, r.area_m2, r.name, r.locality, res.ownership, bench),
      };
    })
    .filter(r => r.price === 0 || (r.price >= pmin && r.price <= pmax));

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
}
