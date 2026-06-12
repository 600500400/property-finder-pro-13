import { createServerFn } from "@tanstack/react-start";

export type PlanInfo = {
  is_premium: boolean;
  plan: "free" | "premium_monthly" | "premium_yearly";
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export const getMyPlan = createServerFn({ method: "GET" }).handler(async (): Promise<PlanInfo> => {
  const { viewerUserId, isUserPremium } = await import("./premium.server");
  const userId = await viewerUserId();
  if (!userId) {
    return { is_premium: false, plan: "free", status: null, current_period_end: null, cancel_at_period_end: false };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const isPremium = await isUserPremium(userId);
  return {
    is_premium: isPremium,
    plan: (isPremium ? (data?.plan as PlanInfo["plan"]) : "free") ?? "free",
    status: data?.status ?? null,
    current_period_end: data?.current_period_end ?? null,
    cancel_at_period_end: data?.cancel_at_period_end ?? false,
  };
});
