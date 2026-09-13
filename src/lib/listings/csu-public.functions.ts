import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getCsuCalibration = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env['SUPABASE_ANON_KEY'] ?? process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) return null;
  const supabasePublic = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data } = await supabasePublic.from("csu_house_calibration_band")
    .select("size_band, factor, typical_area_m2, sample_count, computed_at");
  if (!data?.length) return null;
  const order = ["lt100", "100_150", "150_250", "gt250"];
  return {
    bands: [...data]
      .sort((a, b) => order.indexOf(a.size_band) - order.indexOf(b.size_band))
      .map(row => ({
        sizeBand: row.size_band,
        factor: Number(row.factor),
        typicalAreaM2: row.typical_area_m2 == null ? null : Number(row.typical_area_m2),
        sampleCount: row.sample_count,
      })),
    computedAt: data[0].computed_at,
    sampleCount: data.reduce((sum, row) => sum + row.sample_count, 0),
  };
});
