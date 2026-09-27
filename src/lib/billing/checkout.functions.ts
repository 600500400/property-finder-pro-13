import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanInput = z.object({ plan: z.enum(["premium_monthly", "premium_yearly"]) });
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { startCheckout } = await import("./checkout.server");
    return startCheckout(context.userId, context.claims.email as string | undefined, data.plan);
  });
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { openBillingPortal } = await import("./checkout.server");
    return openBillingPortal(context.userId);
  });
export const getBillingEnvironment = createServerFn({ method: "GET" }).handler(async () => {
  const { billingMode } = await import("./config.server");
  return { mode: billingMode() };
});
