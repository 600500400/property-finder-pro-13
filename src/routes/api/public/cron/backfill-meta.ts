import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { backfillListingsMeta } from "@/lib/listings/backfill.functions";

/** One-off maintenance endpoint: recompute `kraj` from city + clamp `area_m2`
 * for every existing listing. Same auth as the scrape cron routes. */
export const Route = createFileRoute("/api/public/cron/backfill-meta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const result = await backfillListingsMeta();
        return Response.json(result);
      },
    },
  },
});
