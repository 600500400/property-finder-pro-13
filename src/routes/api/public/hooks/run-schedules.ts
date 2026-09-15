import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import type { ScanFilters } from "@/lib/scanner/types";

// Cron endpoint volaný z pg_cron. Vybere scheduled_scans které mají běžet
// (na základě last_run_at + frequency_per_day) a uloží výsledky do scan_results.
// Email rozesílka se napojí v dalším kroku (Lovable Emails).
export const Route = createFileRoute("/api/public/hooks/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Musí být první krok: bez platného CRON_SECRET se nic nenačítá ani nespouští.
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { executeScan } = await import("@/lib/scanner/scan-internal.server");
        const now = new Date();

        const { data: schedules, error } = await supabaseAdmin
          .from("scheduled_scans")
          .select("id, user_id, filters, email, frequency_per_day, max_per_email, last_run_at")
          .eq("enabled", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let processed = 0;
        for (const s of schedules ?? []) {
          const intervalMs = (24 * 3600 * 1000) / s.frequency_per_day;
          if (s.last_run_at && now.getTime() - new Date(s.last_run_at as string).getTime() < intervalMs) {
            continue;
          }
          try {
            const result = await executeScan(s.filters as unknown as ScanFilters);
            const top = result.results.slice(0, s.max_per_email as number);
            await supabaseAdmin.from("scan_results").insert({
              scheduled_scan_id: s.id,
              user_id: s.user_id,
              count: result.count,
              results: top as unknown as never,
              meta: (result.meta ?? {}) as unknown as never,
              emailed: false,
            });
            await supabaseAdmin.from("scheduled_scans")
              .update({ last_run_at: now.toISOString() })
              .eq("id", s.id);
            processed++;
          } catch (e) {
            console.error(`[cron] scan ${s.id} failed:`, e);
          }
        }
        return Response.json({ ok: true, processed, total: schedules?.length ?? 0 });
      },
    },
  },
});
