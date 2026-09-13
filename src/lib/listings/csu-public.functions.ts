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
  const { data } = await supabasePublic.from("csu_house_calibration")
    .select("median_ratio, sample_count, computed_at").eq("singleton", true).maybeSingle();
  if (!data) return null;
  return {
    premiumPct: Math.round((Number(data.median_ratio) - 1) * 100),
    sampleCount: data.sample_count,
    computedAt: data.computed_at,
  };
});