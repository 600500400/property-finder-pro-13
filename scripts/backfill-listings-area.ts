#!/usr/bin/env bun
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseArea } from "../src/lib/scanner/valuation";
import { sanitizeAreaM2 } from "../src/lib/scanner/kraj-mapping";

const SEP = "\u001f";
const out = execSync(
  `psql -At -F'${SEP}' -c "SELECT id, title, area_m2, raw_data->>'name' AS rname, raw_data->>'description_snippet' AS rdesc, raw_data->>'area' AS rarea FROM public.listings"`,
  { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
);
const rows = out.trim().split("\n").filter(Boolean).map(line => {
  const [id, title, area, rname, rdesc, rarea] = line.split(SEP);
  return { id, title, area: area === "" ? null : Number(area), rname, rdesc, rarea };
});
console.log(`scanned ${rows.length} rows`);

const updates: Array<{ id: string; area: number | null }> = [];
for (const r of rows) {
  const cand = parseArea(r.rname || r.title) ?? parseArea(r.rarea) ?? parseArea(r.rdesc);
  const newArea = sanitizeAreaM2(cand ?? null);
  if (newArea !== r.area) updates.push({ id: r.id, area: newArea });
}
console.log(`will update ${updates.length} rows`);

const B = 500;
for (let i = 0; i < updates.length; i += B) {
  const slice = updates.slice(i, i + B);
  const values = slice.map(u => `('${u.id}'::uuid, ${u.area == null ? "NULL" : u.area}::numeric)`).join(",\n");
  const sql = `UPDATE public.listings AS l SET area_m2 = v.area FROM (VALUES\n${values}\n) AS v(id, area) WHERE l.id = v.id;`;
  const f = `/tmp/backfill-area-${i}.sql`;
  writeFileSync(f, sql);
  execSync(`psql -f ${f}`, { stdio: "inherit" });
}
console.log("done");
