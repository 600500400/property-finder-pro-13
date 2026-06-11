import { createServerFn } from "@tanstack/react-start";
import { parseArea } from "@/lib/scanner/valuation";
import { sanitizeAreaM2 } from "@/lib/scanner/kraj-mapping";

/** Re-derive `area_m2` from raw_data title/description using the fixed
 * parseArea regex (handles "62,24 m2" → 62). Updates rows where the
 * re-parsed value differs after the 10–2000 clamp. Idempotent. */
export const backfillListingsArea = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const pageSize = 1000;
  let from = 0;
  let scanned = 0;
  let updated = 0;
  let cleared = 0;
  let set = 0;

  for (;;) {
    const { data: rows, error } = await supabaseAdmin
      .from("listings")
      .select("id, title, area_m2, raw_data")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;
    scanned += rows.length;

    for (const r of rows) {
      const raw = (r.raw_data ?? {}) as Record<string, unknown>;
      const title =
        (typeof raw.name === "string" && raw.name) ||
        r.title ||
        "";
      const desc =
        (typeof raw.description_snippet === "string" && raw.description_snippet) ||
        (typeof raw.description === "string" && raw.description) ||
        "";
      const areaText =
        (typeof raw.area === "string" && raw.area) || "";
      // Prefer title (most reliable), then explicit area field, then description.
      const candidate =
        parseArea(title) ?? parseArea(areaText) ?? parseArea(desc);
      const newArea = sanitizeAreaM2(candidate ?? null);
      const oldArea = r.area_m2 == null ? null : Number(r.area_m2);
      if (newArea === oldArea) continue;

      const { error: upErr } = await supabaseAdmin
        .from("listings")
        .update({ area_m2: newArea })
        .eq("id", r.id);
      if (upErr) {
        console.error("[backfill-area] failed id", r.id, upErr.message);
        continue;
      }
      updated++;
      if (newArea == null) cleared++;
      else set++;
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { scanned, updated, set, cleared };
});
