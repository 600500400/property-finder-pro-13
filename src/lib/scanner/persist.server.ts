import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DealType, Listing, PropertyType, ScanFilters, SourceKey } from "./types";
import { resolveOwnership } from "./ownership";
import { deriveExternalId } from "./external-id";
import { regionFromLocality, sanitizeAreaM2 } from "./kraj-mapping";

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
  const limit = FAST_SOURCES.has(sourceKey) ? 100 : 50;

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
      per_source_limit: limit,
    };

    const fetcher = FETCHERS[sourceKey];
    const listings = await fetcher(filters);
    counts.items_found = listings.length;

    const now = new Date().toISOString();
    let newCount = 0;
    let updatedCount = 0;
    const newUrls: string[] = [];

    for (const l of listings) {
      if (!l.url) continue;
      const external_id = deriveExternalId(sourceKey, l.url);
      const own = resolveOwnership(l, filters);

      // Check existence to count new vs updated
      const { data: existing } = await supabaseAdmin
        .from("listings")
        .select("id")
        .eq("source", sourceKey)
        .eq("external_id", external_id)
        .maybeSingle();

      const area_m2 = sanitizeAreaM2(l.area_m2 ?? null);
      const kraj = regionFromLocality(l.locality);
      const price = l.price || null;
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
        // price_per_m2 is a generated column — do not set
        ownership: own.ownership,
        ownership_confidence: own.ownership_confidence,
        url: l.url,
        image_url: l.img || null,
        description_snippet: l.description_snippet || null,
        raw_data: JSON.parse(JSON.stringify(l)),
        last_seen_at: now,
        is_active: true,
      };

      const { error: upErr } = await supabaseAdmin
        .from("listings")
        .upsert(row, { onConflict: "source,external_id" });
      if (upErr) {
        console.error(`[persist:${sourceKey}] upsert error`, upErr.message);
        continue;
      }
      if (existing) {
        updatedCount++;
      } else {
        newCount++;
        newUrls.push(l.url);
      }
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
