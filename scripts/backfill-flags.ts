import { createClient } from "@supabase/supabase-js";
import { detectFlags } from "../src/lib/scanner/flags";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const PAGE = 500;
  let from = 0;
  let total = 0;
  let withFlags = 0;
  let updated = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, description_snippet, price, area_m2, kraj, raw_data")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      total++;
      const flags = detectFlags({
        title: row.title as string | null,
        description: row.description_snippet as string | null,
        raw_data: row.raw_data,
        price: row.price as number | null,
        area_m2: row.area_m2 as number | null,
        kraj: row.kraj as string | null,
      });
      if (flags.length > 0) withFlags++;
      const { error: upErr } = await supabase
        .from("listings")
        .update({ flags: flags as unknown as never })
        .eq("id", row.id as string);
      if (upErr) {
        console.error("update fail", row.id, upErr.message);
      } else {
        updated++;
      }
    }
    console.log(`progress: scanned=${total} withFlags=${withFlags} updated=${updated}`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(JSON.stringify({ total, withFlags, updated }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
