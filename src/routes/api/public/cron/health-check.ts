import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { computeScraperHealth, sendHealthAlert } from "@/lib/health/scraper-health.server";

export const Route = createFileRoute("/api/public/cron/health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const health = await computeScraperHealth();
        const unhealthy = health.filter((h) => h.indicator === "red");
        const alert = unhealthy.length > 0 ? await sendHealthAlert(unhealthy) : { sent: 0, errors: [] };
        return Response.json({ ok: true, checked: health.length, unhealthy: unhealthy.length, ...alert, health });
      },
    },
  },
});
