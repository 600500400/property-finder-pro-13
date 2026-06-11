#!/usr/bin/env bun
/**
 * One-off backfill: compute `kraj`, sanitize `area_m2` (10–2000), and recompute
 * `price_per_m2` for every existing listing using the same helpers persist.server.ts
 * uses on write.  Run once via:  bun run scripts/backfill-listings-meta.ts
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { regionFromLocality, sanitizeAreaM2 } from "../src/lib/scanner/kraj-mapping";

interface Row { id: string; city: string | null; price: number | null; area_m2: number | null; kraj: string | null; price_per_m2: number | null }

function sql(q: string): string {
  return execSync(`psql -At -F'\u001f' -c ${JSON.stringify(q)}`, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function sqlExec(q: string, idx: number) {
  const f = `/tmp/backfill-batch-${idx}.sql`;
  writeFileSync(f, q);
  console.log(`Wrote batch ${idx} → ${f}`);
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

const raw = sql("SELECT id, city, price, area_m2, kraj, price_per_m2 FROM public.listings;");
const rows: Row[] = raw.trim().split("\n").filter(Boolean).map(line => {
  const [id, city, price, area, kraj, ppm] = line.split("\u001f");
  return {
    id,
    city: city === "" ? null : city,
    price: price === "" ? null : Number(price),
    area_m2: area === "" ? null : Number(area),
    kraj: kraj === "" ? null : kraj,
    price_per_m2: ppm === "" ? null : Number(ppm),
  };
});

console.log(`Loaded ${rows.length} listings.`);

let changed = 0;
const updates: Array<{ id: string; kraj: string | null; area: number | null }> = [];
for (const r of rows) {
  const newKraj = regionFromLocality(r.city);
  const newArea = sanitizeAreaM2(r.area_m2);
  if (newKraj !== r.kraj || newArea !== r.area_m2) {
    updates.push({ id: r.id, kraj: newKraj, area: newArea });
    changed++;
  }
}

console.log(`Need to update ${changed} rows.`);
let krajMapped = 0;
for (const u of updates) if (u.kraj) krajMapped++;
console.log(`  rows that will receive a kraj: ${krajMapped}`);

const BATCH = 500;
for (let i = 0; i < updates.length; i += BATCH) {
  const slice = updates.slice(i, i + BATCH);
  const values = slice.map(u => {
    const k = u.kraj ? `'${esc(u.kraj)}'` : "NULL";
    const a = u.area == null ? "NULL" : String(u.area);
    return `('${u.id}'::uuid, ${k}::text, ${a}::numeric)`;
  }).join(",\n");
  const q = `UPDATE public.listings AS l
SET kraj = v.kraj, area_m2 = v.area
FROM (VALUES
${values}
) AS v(id, kraj, area)
WHERE l.id = v.id;`;
  sqlExec(q, i / BATCH);
}
console.log(`\nWrote ${Math.ceil(updates.length / BATCH)} batches.`);

