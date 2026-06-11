import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { backfillListingsArea } from "@/lib/listings/backfill-area.functions";

/** One-off maintenance: re-derive area_m2 from raw_data title/description
 * using the fixed Czech-decimal regex. Same auth as other cron routes. */
export const Route = createFileRoute("/api/public/cron/backfill-area")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const result = await backfillListingsArea();
        return Response.json(result);
      },
    },
  },
});
