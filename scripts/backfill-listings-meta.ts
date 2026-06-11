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
import { regionFromLocality, sanitizeAreaM2, derivePricePerM2 } from "../src/lib/scanner/kraj-mapping";

interface Row { id: string; city: string | null; price: number | null; area_m2: number | null; kraj: string | null; price_per_m2: number | null }

function sql(q: string): string {
  return execSync(`psql -At -F'\u001f' -c ${JSON.stringify(q)}`, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function sqlExec(q: string) {
  const tmp = mkdtempSync(join(tmpdir(), "bf-"));
  const f = join(tmp, "q.sql");
  writeFileSync(f, q);
  execSync(`psql -v ON_ERROR_STOP=1 -f ${f}`, { stdio: "inherit" });
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
const updates: Array<{ id: string; kraj: string | null; area: number | null; ppm: number | null }> = [];
for (const r of rows) {
  const newKraj = regionFromLocality(r.city);
  const newArea = sanitizeAreaM2(r.area_m2);
  const newPpm = derivePricePerM2(r.price, newArea);
  if (newKraj !== r.kraj || newArea !== r.area_m2 || newPpm !== r.price_per_m2) {
    updates.push({ id: r.id, kraj: newKraj, area: newArea, ppm: newPpm });
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
    const p = u.ppm == null ? "NULL" : String(u.ppm);
    return `('${u.id}'::uuid, ${k}::text, ${a}::numeric, ${p}::integer)`;
  }).join(",\n");
  const q = `UPDATE public.listings AS l
SET kraj = v.kraj, area_m2 = v.area, price_per_m2 = v.ppm
FROM (VALUES
${values}
) AS v(id, kraj, area, ppm)
WHERE l.id = v.id;`;
  sqlExec(q);
  process.stdout.write(`  applied ${Math.min(i + BATCH, updates.length)} / ${updates.length}\r`);
}
console.log("\nDone.");
