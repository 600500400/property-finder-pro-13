import { createServerFn } from "@tanstack/react-start";

export type Tier = "anonymous" | "free" | "premium";

export type PlanInfo = {
  tier: Tier;
  is_premium: boolean;
  plan: "free" | "premium_monthly" | "premium_yearly";
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** Free users get exactly one AI sample ever; true once they've spent it. */
  free_ai_sample_used: boolean;
};

export const getMyPlan = createServerFn({ method: "GET" }).handler(async (): Promise<PlanInfo> => {
  const { viewerUserId, isUserPremium } = await import("./premium.server");
  const userId = await viewerUserId();
  if (!userId) {
    return {
      tier: "anonymous",
      is_premium: false,
      plan: "free",
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
      free_ai_sample_used: false,
    };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: sub }, { count: aiCount }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("ai_analysis_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  const isPremium = await isUserPremium(userId);
  return {
    tier: isPremium ? "premium" : "free",
    is_premium: isPremium,
    plan: (isPremium ? (sub?.plan as PlanInfo["plan"]) : "free") ?? "free",
    status: sub?.status ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
    free_ai_sample_used: (aiCount ?? 0) >= 1,
  };
});
