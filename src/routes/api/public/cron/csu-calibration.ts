import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";

export const Route = createFileRoute("/api/public/cron/csu-calibration")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: listings, error } = await supabaseAdmin.from("listings")
          .select("price, area_m2, kraj")
          .eq("property_type", "domy").eq("is_active", true)
          .not("price", "is", null).not("area_m2", "is", null)
          .limit(10000);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const { data: krajRows } = await supabaseAdmin.from("csu_house_prices_kraj")
          .select("kraj, price_2025").is("band", null);
        const benchmarks = new Map((krajRows ?? []).map(row => [row.kraj, Number(row.price_2025)]));
        const ratios = (listings ?? []).flatMap(row => {
          const benchmark = row.kraj ? benchmarks.get(row.kraj) : undefined;
          const area = Number(row.area_m2);
          const asking = Number(row.price) / area;
          return benchmark && area > 0 && asking >= 3_000 && asking <= 400_000 ? [asking / benchmark] : [];
        }).sort((a, b) => a - b);
        if (!ratios.length) return Response.json({ ok: false, error: "No comparable houses" }, { status: 422 });
        const mid = Math.floor(ratios.length / 2);
        const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
        const { error: updateError } = await supabaseAdmin.from("csu_house_calibration").upsert({
          singleton: true, median_ratio: Number(median.toFixed(4)), sample_count: ratios.length, computed_at: new Date().toISOString(),
        });
        if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });
        return Response.json({ ok: true, sample_count: ratios.length, median_ratio: Number(median.toFixed(4)) });
      },
    },
  },
});