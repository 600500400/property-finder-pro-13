import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Listing, ScanFilters, ScanResult, SourceKey } from "@/lib/scanner/types";
import type { RentComp } from "./yield.server";

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
  sub_type: z.enum(["garaz", "garazove_stani", ""]).default(""),
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

    

    // ----- main query -----
    let q = supabaseAdmin
      .from("listings")
      .select("source, external_id, title, price, deal_type, property_type, kraj, city, area_m2, price_per_m2, ownership, ownership_confidence, url, image_url, description_snippet, first_seen_at, last_seen_at, raw_data")
      .eq("is_active", true)
      .eq("deal_type", filters.deal_type)
      .eq("property_type", filters.property_type);

    if (filters.region) q = q.eq("kraj", filters.region);
    if (filters.sources.length > 0) q = q.in("source", filters.sources);
    if (filters.price_min != null) q = q.gte("price", filters.price_min);
    if (filters.price_max != null) q = q.lte("price", filters.price_max);
    if (filters.freshness === "24h") {
      q = q.gte("first_seen_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    } else if (filters.freshness === "7d") {
      q = q.gte("first_seen_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());
    }

    // Server-side ordering (date/price only — yield is post-computed)
    if (filters.sort_by === "price_asc") q = q.order("price", { ascending: true, nullsFirst: false });
    else if (filters.sort_by === "price_desc") q = q.order("price", { ascending: false, nullsFirst: false });
    else q = q.order("first_seen_at", { ascending: false });

    q = q.limit(500);

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
        .eq("property_type", filters.property_type)
        .not("area_m2", "is", null)
        .not("price", "is", null);
      rentIndex = indexRentComps((rents ?? []) as RentComp[]);
    }

    const bench = await getBenchmark();

    // ----- map → UI Listing[] -----
    const results: Listing[] = (rows ?? []).map((r) => {
      const sourceKey = r.source as SourceKey;
      const price = r.price ?? 0;
      const areaM2 = r.area_m2 ?? null;
      const priceText = price ? `${price.toLocaleString("cs-CZ").replace(/,/g, " ")} Kč` : "Dohodou";
      const inv = filters.deal_type === "prodej"
        ? computeHybridYield({
            price,
            region: (r.kraj ?? "") as ScanFilters["region"],
            propertyType: filters.property_type,
            areaM2,
            name: r.title ?? "",
            locality: r.city ?? "",
            ownership: (r.ownership ?? undefined) as "osobni" | "druzstevni" | "jine" | undefined,
            kraj: r.kraj,
            bench,
            rentIndex,
          })
        : null;
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
        published_at: r.first_seen_at,
        published_at_source: "html",
        ownership: (r.ownership ?? undefined) as Listing["ownership"],
        ownership_confidence: (r.ownership_confidence ?? undefined) as Listing["ownership_confidence"],
        description_snippet: r.description_snippet ?? undefined,
        invest: inv,
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
      },
    };
  });
