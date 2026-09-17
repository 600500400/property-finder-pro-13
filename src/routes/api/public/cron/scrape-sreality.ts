import { createFileRoute } from "@tanstack/react-router";
import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { runSourceScrape } from "@/lib/scanner/persist.server";
import type { DealType, PropertyType } from "@/lib/scanner/types";

const MORAVA = ["jihomoravsky", "moravskoslezsky", "olomoucky", "zlinsky"];
const ALL = [
  "jihomoravsky", "moravskoslezsky", "olomoucky", "zlinsky",
  "praha", "stredocesky", "jihocesky", "plzensky", "karlovarsky",
  "ustecky", "liberecky", "kralovehradecky", "pardubicky", "vysocina",
];

export const Route = createFileRoute("/api/public/cron/scrape-sreality")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request)) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as {
          dealType?: DealType;
          propertyType?: PropertyType;
          region?: string;
          scope?: "morava" | "all";
          regions?: string[];
        };
        const dealType = body.dealType || "prodej";
        const propertyType = body.propertyType || "domy";

        if (body.scope || (body.regions && body.regions.length > 0)) {
          const targets = body.scope === "morava" ? MORAVA : body.scope === "all" ? ALL : (body.regions ?? [body.region || ""]);
          const results = [];
          for (const reg of targets) {
            const res = await runSourceScrape("sreality", dealType, propertyType, reg);
            results.push(res);
            await new Promise((r) => setTimeout(r, 200));
          }
          const totalFound = results.reduce((acc, r) => acc + (r.items_found || 0), 0);
          const totalNew = results.reduce((acc, r) => acc + (r.items_new || 0), 0);
          const totalUpdated = results.reduce((acc, r) => acc + (r.items_updated || 0), 0);
          return Response.json({ ok: true, targets, totalFound, totalNew, totalUpdated, results });
        }

        if (!body.dealType || !body.propertyType) return new Response("Missing dealType/propertyType", { status: 400 });
        const result = await runSourceScrape("sreality", body.dealType, body.propertyType, body.region);
        return Response.json(result);
      },
    },
  },
});
