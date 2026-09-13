import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Listing, ScanFilters, ScanResult, SourceKey } from "@/lib/scanner/types";
import type { RentComp } from "./yield.server";
import { indexPriceComps, computePriceCompare, type PriceCompRow } from "./price-compare";
import { buildCsuIndexes, computeCsuHouseCompare, type CsuKrajRow, type CsuOkresRow, type PopulationRow } from "./csu-benchmark";


const SOURCE_LABEL: Record<SourceKey, string> = {
  sreality: "Sreality",
  bazos: "Bazoš",
  bezrealitky: "Bezrealitky",
  hyperinzerce: "Hyperinzerce",
  realitymix: "RealityMix",
  annonce: "Annonce",
  idnes: "iDnes Reality",
};

const FilterSchema = z.object({
  deal_type: z.enum(["prodej", "pronajem"]),
  property_type: z.enum(["ostatni", "byty", "domy", "pozemky", "komercni"]),
  property_types: z.array(z.enum(["ostatni", "byty", "domy", "pozemky", "komercni"])).optional(),
  sub_type: z.enum(["garaz", "garazove_stani", ""]).default(""),
  region: z.enum([
    "", "praha", "stredocesky", "jihocesky", "jihomoravsky", "karlovarsky",
    "kralovehradecky", "liberecky", "moravskoslezsky", "olomoucky",
    "pardubicky", "plzensky", "ustecky", "vysocina", "zlinsky",
  ]),
  regions: z.array(z.string()).optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  land_area_min: z.number().optional(),
  land_area_max: z.number().optional(),
  sources: z.array(z.enum([
    "sreality", "bazos", "bezrealitky", "hyperinzerce", "realitymix", "annonce", "idnes",
  ])),
  sort_by: z.enum(["source", "price_asc", "price_desc", "yield", "date_desc"]),
  // freshness: '' = all, '24h' or '7d' filters first_seen_at
  freshness: z.enum(["", "24h", "7d"]).default(""),
});

export const queryListings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FilterSchema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    type QF = ScanFilters & { freshness: "" | "24h" | "7d" };
    const filters: QF = data as QF;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getBenchmark } = await import("@/lib/scanner/rent-benchmark.server");
    const { indexRentComps, computeHybridYield } = await import("./yield.server");
    const { viewerTier } = await import("@/lib/billing/premium.server");

    // byt / dům / both — falls back to the single property_type for older clients
    const propertyTypes = filters.property_types?.length ? filters.property_types : [filters.property_type];

    const { tier } = await viewerTier();
    const isPremium = tier === "premium";
    // 3-way result cap: anon 20 / free 50 / premium 500
    const RESULT_CAP = tier === "anonymous" ? 20 : tier === "free" ? 50 : 500;

    // ----- main query -----
    let q = supabaseAdmin
      .from("listings")
      .select("source, external_id, title, price, deal_type, property_type, house_subtype, kraj, city, area_m2, land_area_m2, price_per_m2, ownership, ownership_confidence, url, image_url, description_snippet, first_seen_at, last_seen_at, raw_data, flags")
      .eq("is_active", true)
      .eq("deal_type", filters.deal_type)
      .in("property_type", propertyTypes);

    // Multi-select kraj wins over the legacy single-region field.
    const regions = (filters.regions ?? []).filter(Boolean);
    if (regions.length > 0) q = q.in("kraj", regions);
    else if (filters.region) q = q.eq("kraj", filters.region);
    if (filters.sources.length > 0) q = q.in("source", filters.sources);
    if (filters.price_min != null) q = q.gte("price", filters.price_min);
    if (filters.price_max != null) q = q.lte("price", filters.price_max);
    // Plocha pozemku — houses only (flats have no land_area_m2, so they drop out).
    if (filters.land_area_min != null) q = q.gte("land_area_m2", filters.land_area_min);
    if (filters.land_area_max != null) q = q.lte("land_area_m2", filters.land_area_max);
    if (filters.freshness === "24h") {
      q = q.gte("first_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    } else if (filters.freshness === "7d") {
      q = q.gte("first_seen_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());
    }

    // Non-premium (anon + free): exclude listings first seen in the last 24h (realtime is Premium-only)
    if (!isPremium) {
      q = q.lt("first_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    }

    if (filters.sort_by === "price_asc") q = q.order("price", { ascending: true, nullsFirst: false });
    else if (filters.sort_by === "price_desc") q = q.order("price", { ascending: false, nullsFirst: false });
    else q = q.order("first_seen_at", { ascending: false });

    q = q.limit(RESULT_CAP);


    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // ----- rent comps for hybrid yield (only for sale views) -----
    let rentIndex = new Map<string, RentComp[]>();
    if (filters.deal_type === "prodej") {
      const { data: rents } = await supabaseAdmin
        .from("listings")
        .select("kraj, property_type, area_m2, price")
        .eq("is_active", true)
        .eq("deal_type", "pronajem")
        .in("property_type", propertyTypes)
        .not("area_m2", "is", null)
        .not("price", "is", null);
      rentIndex = indexRentComps((rents ?? []) as RentComp[]);
    }

    // ----- asking Kč/m² comparables (same deal type, never mixing byty × domy) -----
    // PostgREST returns at most 1000 rows per request, so page through explicitly.
    const compRows: PriceCompRow[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 30000; from += PAGE) {
      const { data: chunk } = await supabaseAdmin
        .from("listings")
        .select("property_type, house_subtype, kraj, city, area_m2, price, url, title, flags")
        .eq("is_active", true)
        .eq("deal_type", filters.deal_type)
        .in("property_type", propertyTypes)
        .not("area_m2", "is", null)
        .not("price", "is", null)
        .range(from, from + PAGE - 1);
      if (!chunk?.length) break;
      compRows.push(...(chunk as PriceCompRow[]));
      if (chunk.length < PAGE) break;
    }
    const priceIndex = indexPriceComps(compRows);

    const [{ data: okresData }, { data: krajData }, { data: calibrationData }] = await Promise.all([
      supabaseAdmin.from("csu_house_prices_okres").select("kraj, okres, level, avg_size_m2, price_2025, band, band_price_uplifted"),
      supabaseAdmin.from("csu_house_prices_kraj").select("kraj, band, price_2025, avg_size_m2"),
      supabaseAdmin.from("csu_house_calibration").select("median_ratio").eq("singleton", true).maybeSingle(),
    ]);
    const populationData: PopulationRow[] = [];
    for (let from = 0; from < 10000; from += PAGE) {
      const { data: chunk } = await supabaseAdmin.from("obce_population")
        .select("kraj, name, name_norm, population, is_ambiguous_in_kraj")
        .range(from, from + PAGE - 1);
      if (!chunk?.length) break;
      populationData.push(...(chunk as PopulationRow[]));
      if (chunk.length < PAGE) break;
    }
    const csuIndexes = buildCsuIndexes((okresData ?? []) as CsuOkresRow[], (krajData ?? []) as CsuKrajRow[], populationData);
    const askingPremiumPct = calibrationData?.median_ratio != null
      ? Math.round((Number(calibrationData.median_ratio) - 1) * 100)
      : undefined;

    const bench = await getBenchmark();

    // ----- map → UI Listing[] -----
    const results: Listing[] = (rows ?? []).map((r) => {
      const sourceKey = r.source as SourceKey;
      const price = r.price ?? 0;
      const areaM2 = r.area_m2 ?? null;
      const propertyType = (r.property_type ?? filters.property_type) as ScanFilters["property_type"];
      const priceText = price ? `${price.toLocaleString("cs-CZ").replace(/,/g, " ")} Kč` : "Dohodou";
      // Rental yield is only meaningful for flats — houses have no reliable rent comps.
      const inv = filters.deal_type === "prodej" && propertyType !== "domy"
        ? computeHybridYield({
            price,
            region: (r.kraj ?? "") as ScanFilters["region"],
            propertyType,
            areaM2,
            name: r.title ?? "",
            locality: r.city ?? "",
            ownership: (r.ownership ?? undefined) as "osobni" | "druzstevni" | "jine" | undefined,
            kraj: r.kraj,
            bench,
            rentIndex,
          })
        : null;
      const priceCompare = computePriceCompare({
        propertyType,
        kraj: r.kraj,
        city: r.city,
        areaM2,
        price: r.price,
        index: priceIndex,
        selfUrl: r.url,
        title: r.title,
        description: r.description_snippet,
        houseSubtype: r.house_subtype,
      }) ?? undefined;
      const csuCompare = propertyType === "domy" ? computeCsuHouseCompare({
        kraj: r.kraj,
        locality: r.city,
        areaM2,
        price: r.price,
        indexes: csuIndexes,
        askingPremiumPct,
      }) ?? undefined : undefined;

      return {
        source: SOURCE_LABEL[sourceKey] ?? sourceKey,
        source_key: sourceKey,
        name: r.title ?? "",
        locality: r.city ?? "",
        price,
        price_text: priceText,
        url: r.url,
        img: r.image_url ?? "",
        area: areaM2 ? `${areaM2} m²` : "",
        area_m2: areaM2 ?? undefined,
        land_area_m2: r.land_area_m2 ?? undefined,
        published_at: r.first_seen_at,
        published_at_source: "html",
        ownership: (r.ownership ?? undefined) as Listing["ownership"],
        ownership_confidence: (r.ownership_confidence ?? undefined) as Listing["ownership_confidence"],
        description_snippet: r.description_snippet ?? undefined,
        flags: (r.flags as unknown as Listing["flags"]) ?? [],
        invest: inv,
        property_type: propertyType,
        house_subtype: (r.house_subtype ?? undefined) as Listing["house_subtype"],
        price_compare: priceCompare,
        csu_compare: csuCompare,

      };
    });

    // Yield sort (post-compute)
    if (filters.sort_by === "yield") {
      results.sort((a, b) => (b.invest?.net_yield ?? -1) - (a.invest?.net_yield ?? -1));
    }

    return {
      count: results.length,
      results,
      diagnostics: [],
      ts: new Date().toISOString(),
      meta: {
        benchmark_fetched_at: bench.fetched_at,
        benchmark_source: bench.source,
        benchmark_live_okresy: bench.live_okresy,
        benchmark_static_okresy: bench.static_okresy,
        is_premium: isPremium,
        tier,
        result_cap: RESULT_CAP,
        free_capped: !isPremium && results.length >= RESULT_CAP,
        csu_asking_premium_pct: askingPremiumPct,
      },
    };
  });
