import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DealType, Listing, PropertyType, ScanFilters, SourceKey } from "./types";
import { resolveOwnership } from "./ownership";
import { deriveExternalId } from "./external-id";
import { regionFromLocality, sanitizeAreaM2 } from "./kraj-mapping";
import { detectFlags } from "./flags";
import { deriveHouseSubtype } from "./house-subtype";
import { parseLandArea } from "./land-area";

import { fetchSreality } from "./sources/sreality.server";
import { fetchBezrealitky } from "./sources/bezrealitky.server";
import { fetchBazos } from "./sources/bazos.server";
import { fetchIdnes, fetchRealityMix } from "./sources/firecrawl.server";
import { fetchAnnonce } from "./sources/annonce.server";
import { fetchHyperinzerce } from "./sources/hyperinzerce.server";

const FETCHERS: Record<SourceKey, (f: ScanFilters) => Promise<Listing[]>> = {
  sreality: fetchSreality,
  bezrealitky: fetchBezrealitky,
  bazos: fetchBazos,
  hyperinzerce: fetchHyperinzerce,
  realitymix: fetchRealityMix,
  annonce: fetchAnnonce,
  idnes: fetchIdnes,
};

const FAST_SOURCES = new Set<SourceKey>(["sreality", "bezrealitky", "bazos"]);

export interface RunResult {
  source: SourceKey;
  deal_type: DealType;
  property_type: PropertyType;
  status: "success" | "error";
  items_found: number;
  items_new: number;
  items_updated: number;
  items_deactivated: number;
  duration_ms: number;
  error?: string;
  run_id: string;
}

export async function runSourceScrape(
  sourceKey: SourceKey,
  dealType: DealType,
  propertyType: PropertyType,
): Promise<RunResult> {
  const startedAt = Date.now();

  // Flats + houses only: skip any other property type.
  // Guard prevents accidental ingestion of land/commercial/other categories.
  if (propertyType !== "byty" && propertyType !== "domy") {
    return {
      source: sourceKey,
      deal_type: dealType,
      property_type: propertyType,
      status: "success",
      items_found: 0,
      items_new: 0,
      items_updated: 0,
      items_deactivated: 0,
      duration_ms: Date.now() - startedAt,
      run_id: "",
      error: "skipped: only property_type 'byty' or 'domy' is scraped",
    };
  }
  const limit = FAST_SOURCES.has(sourceKey) ? 100 : 50;
  // Houses are a much smaller national pool than flats, so we walk deeper pages
  // to build volume. Flats keep a single page (unchanged behaviour).
  const HOUSE_PAGES: Record<string, number> = {
    sreality: 10,
    bezrealitky: 10,
    bazos: 25,
    idnes: 8,
  };
  const maxPages = propertyType === "domy" ? (HOUSE_PAGES[sourceKey] ?? 1) : 1;
  const perSourceLimit = propertyType === "domy" && sourceKey === "bazos" ? 500 : limit;

  const { data: runRow, error: insertErr } = await supabaseAdmin
    .from("scrape_runs")
    .insert({
      source: sourceKey,
      deal_type: dealType,
      property_type: propertyType,
      status: "running",
    })
    .select("id")
    .single();
  if (insertErr || !runRow) {
    throw new Error(`Failed to create scrape_runs row: ${insertErr?.message}`);
  }
  const runId = runRow.id as string;

  let finalStatus: "success" | "error" = "error";
  let counts = { items_found: 0, items_new: 0, items_updated: 0, items_deactivated: 0 };
  let errorMessage: string | undefined;

  try {
    const filters: ScanFilters = {
      deal_type: dealType,
      property_type: propertyType,
      sub_type: "",
      region: "",
      sources: [sourceKey],
      sort_by: "date_desc",
      per_source_limit: perSourceLimit,
      max_pages: maxPages,
    };

    const fetcher = FETCHERS[sourceKey];
    const listings = await fetcher(filters);
    counts.items_found = listings.length;

    const now = new Date().toISOString();
    let newCount = 0;
    let updatedCount = 0;
    const newUrls: string[] = [];

    // Which external ids already exist? One batched lookup instead of one query per listing.
    const allIds = listings.filter(l => l.url).map(l => deriveExternalId(sourceKey, l.url));
    const existingIds = new Set<string>();
    for (let i = 0; i < allIds.length; i += 200) {
      const { data: found } = await supabaseAdmin
        .from("listings")
        .select("external_id")
        .eq("source", sourceKey)
        .in("external_id", allIds.slice(i, i + 200));
      for (const r of found ?? []) existingIds.add(r.external_id as string);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const l of listings) {
      if (!l.url) continue;
      const external_id = deriveExternalId(sourceKey, l.url);
      const own = resolveOwnership(l, filters);
      const existing = existingIds.has(external_id);

      const area_m2 = sanitizeAreaM2(l.area_m2 ?? null);
      const kraj = regionFromLocality(l.locality);
      const price = l.price || null;
      const flags = detectFlags({
        title: l.name,
        description: l.description_snippet,
        raw_data: l,
        price,
        area_m2,
        kraj,
      });
      // Houses: keep an internal subtype and recover the plot size from text
      // when the portal (Bazoš, iDnes) doesn't expose a structured field.
      const isHouse = propertyType === "domy";
      const structuredLand = typeof l.land_area_m2 === "number" && l.land_area_m2 > 0 ? l.land_area_m2 : null;
      const land_area_m2 = structuredLand
        ?? (isHouse ? (parseLandArea(`${l.name ?? ""} ${l.description_snippet ?? ""}`) ?? null) : null);
      const house_subtype = isHouse
        ? deriveHouseSubtype({ title: l.name, description: l.description_snippet })
        : null;

      const row = {
        source: sourceKey,
        external_id,
        title: l.name || null,
        price,
        deal_type: dealType,
        property_type: propertyType,
        kraj,
        city: l.locality || null,
        area_m2,
        land_area_m2,
        house_subtype,
        // price_per_m2 is a generated column — do not set
        ownership: own.ownership,
        ownership_confidence: own.ownership_confidence,
        url: l.url,
        image_url: l.img || null,
        description_snippet: l.description_snippet || null,
        raw_data: JSON.parse(JSON.stringify(l)),
        flags: flags as unknown as never,
        last_seen_at: now,
        is_active: true,
      };

      rows.push(row);
      if (existing) {
        updatedCount++;
      } else {
        newCount++;
        newUrls.push(l.url);
      }
    }

    // Upsert in chunks; one row per external_id so Postgres never sees a dupe key twice.
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of rows) byId.set(String(r.external_id), r);
    const unique = [...byId.values()];
    for (let i = 0; i < unique.length; i += 100) {
      const { error: upErr } = await supabaseAdmin
        .from("listings")
        .upsert(unique.slice(i, i + 100) as never, { onConflict: "source,external_id" });
      if (upErr) console.error(`[persist:${sourceKey}] upsert error`, upErr.message);
    }


    counts.items_new = newCount;
    counts.items_updated = updatedCount;


    // Soft-delete stale listings for this combination
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: deactivated } = await supabaseAdmin
      .from("listings")
      .update({ is_active: false })
      .eq("source", sourceKey)
      .eq("deal_type", dealType)
      .eq("property_type", propertyType)
      .eq("is_active", true)
      .lt("last_seen_at", cutoff)
      .select("id");
    counts.items_deactivated = deactivated?.length ?? 0;

    // Instant watchdog alerts — best-effort, never break the scrape run
    if (newUrls.length > 0) {
      try {
        const { processInstantAlerts } = await import("@/lib/alerts/notify.server");
        await processInstantAlerts({ source: sourceKey, dealType, propertyType, newUrls });
      } catch (alertErr) {
        console.error(`[persist:${sourceKey}] instant-alert error`, alertErr);
      }
    }

    finalStatus = "success";

  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`[persist:${sourceKey}] run failed`, errorMessage);
  } finally {
    const duration_ms = Date.now() - startedAt;
    await supabaseAdmin
      .from("scrape_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        items_found: counts.items_found,
        items_new: counts.items_new,
        items_updated: counts.items_updated,
        items_deactivated: counts.items_deactivated,
        error_message: errorMessage ?? null,
        duration_ms,
      })
      .eq("id", runId);
  }

  return {
    source: sourceKey,
    deal_type: dealType,
    property_type: propertyType,
    status: finalStatus,
    duration_ms: Date.now() - startedAt,
    error: errorMessage,
    run_id: runId,
    ...counts,
  };
}
