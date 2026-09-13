import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { SIZE_BANDS, sizeBandOf, type SizeBand } from "@/lib/listings/csu-benchmark";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const Route = createFileRoute("/api/public/cron/csu-calibration")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Calibrate INSIDE size bands: our užitná plocha is ~2x the ČSÚ obytná
        // plocha, and that gap varies strongly with house size, so one global
        // ratio produced systematically wrong verdicts.
        const { data: listings, error } = await supabaseAdmin.from("listings")
          .select("price, area_m2, kraj, area_type, source")
          .eq("property_type", "domy").eq("is_active", true)
          .not("price", "is", null).not("area_m2", "is", null)
          .limit(10000);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const { data: krajRows } = await supabaseAdmin.from("csu_house_prices_kraj")
          .select("kraj, price_2025").is("band", null);
        const benchmarks = new Map((krajRows ?? []).map(row => [row.kraj, Number(row.price_2025)]));

        const byBand = new Map<SizeBand, { ratios: number[]; areas: number[] }>();
        for (const band of SIZE_BANDS) byBand.set(band, { ratios: [], areas: [] });
        for (const row of listings ?? []) {
          // "zastavěná plocha" is a different measure; Bazoš has no structured
          // area field at all. Neither may shape the calibration factor.
          if (row.area_type === "zastavena" || row.source === "bazos") continue;
          const benchmark = row.kraj ? benchmarks.get(row.kraj) : undefined;
          const area = Number(row.area_m2);
          if (!benchmark || !(area > 0)) continue;
          const asking = Number(row.price) / area;
          if (asking < 3_000 || asking > 400_000) continue;
          const bucket = byBand.get(sizeBandOf(area))!;
          bucket.ratios.push(asking / benchmark);
          bucket.areas.push(area);
        }

        const rows = SIZE_BANDS.flatMap((band) => {
          const bucket = byBand.get(band)!;
          // Too few houses -> no factor at all; the UI then falls back to a raw,
          // clearly-labelled comparison instead of inventing precision.
          if (bucket.ratios.length < 30) return [];
          const ratio = median(bucket.ratios);
          return [{
            size_band: band,
            median_ratio: Number(ratio.toFixed(4)),
            factor: Number(ratio.toFixed(4)),
            typical_area_m2: Number(median(bucket.areas).toFixed(1)),
            sample_count: bucket.ratios.length,
            computed_at: new Date().toISOString(),
          }];
        });
        if (!rows.length) return Response.json({ ok: false, error: "No comparable houses" }, { status: 422 });
        const { error: upsertError } = await supabaseAdmin
          .from("csu_house_calibration_band").upsert(rows);
        if (upsertError) return Response.json({ ok: false, error: upsertError.message }, { status: 500 });
        return Response.json({ ok: true, bands: rows });
      },
    },
  },
});
