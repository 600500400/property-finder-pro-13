import { createServerFn } from "@tanstack/react-start";
import { regionFromLocality, sanitizeAreaM2 } from "@/lib/scanner/kraj-mapping";

/** One-off maintenance: recompute `kraj` and clamp `area_m2` (10–2000) for
 * every row in `listings` using the same helpers as the live scrape path.
 * Service-role-only; uses no auth middleware so it can be invoked via the
 * dev `stack_modern--invoke-server-function` tool.  Idempotent. */
export const backfillListingsMeta = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const pageSize = 1000;
  let from = 0;
  let scanned = 0;
  let updated = 0;
  let krajSet = 0;

  for (;;) {
    const { data: rows, error } = await supabaseAdmin
      .from("listings")
      .select("id, city, area_m2, kraj")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;
    scanned += rows.length;

    for (const r of rows) {
      const newKraj = regionFromLocality(r.city);
      const newArea = sanitizeAreaM2(r.area_m2 ?? null);
      const krajChanged = newKraj !== r.kraj;
      const areaChanged = newArea !== r.area_m2;
      if (!krajChanged && !areaChanged) continue;
      const { error: upErr } = await supabaseAdmin
        .from("listings")
        .update({ kraj: newKraj, area_m2: newArea })
        .eq("id", r.id);
      if (upErr) {
        console.error("[backfill] failed id", r.id, upErr.message);
        continue;
      }
      updated++;
      if (krajChanged && newKraj) krajSet++;
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { scanned, updated, krajSet };
});
