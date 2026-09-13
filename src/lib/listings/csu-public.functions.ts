import { createServerFn } from "@tanstack/react-start";

export const getCsuCalibration = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("csu_house_calibration")
    .select("median_ratio, sample_count, computed_at").eq("singleton", true).maybeSingle();
  if (!data) return null;
  return {
    premiumPct: Math.round((Number(data.median_ratio) - 1) * 100),
    sampleCount: data.sample_count,
    computedAt: data.computed_at,
  };
});