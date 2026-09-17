import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { runSourceScrape } from "@/lib/scanner/persist.server";
import type { DealType, PropertyType } from "@/lib/scanner/types";

export const Route = createFileRoute("/api/public/cron/scrape-realitymix")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { dealType?: DealType; propertyType?: PropertyType };
        if (!body.dealType || !body.propertyType) return new Response("Missing dealType/propertyType", { status: 400 });
        const result = await runSourceScrape("realitymix", body.dealType, body.propertyType);
        return Response.json(result);
      },
    },
  },
});
