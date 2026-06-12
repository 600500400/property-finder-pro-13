import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanInput = z.object({ plan: z.enum(["premium_monthly", "premium_yearly"]) });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { getStripe, PLAN_PRICES } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();

    const userId = context.userId;
    const email = (context.claims.email as string | undefined) ?? undefined;

    // Resolve / create stripe customer
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin.from("subscriptions").upsert(
        { user_id: userId, plan: "free", status: "incomplete", stripe_customer_id: customerId },
        { onConflict: "user_id" },
      );
    }

    const price = PLAN_PRICES[data.plan];
    const origin = process.env.PUBLIC_APP_URL
      ?? "https://property-finder-pro-13.lovable.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "czk",
          product_data: { name: `RealityScanner — ${price.label}` },
          unit_amount: price.amount,
          recurring: { interval: price.interval },
        },
      }],
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
      metadata: { user_id: userId, plan: data.plan },
      success_url: `${origin}/cenik?checkout=success`,
      cancel_url: `${origin}/cenik?checkout=cancel`,
      allow_promotion_codes: true,
      locale: "cs",
    });

    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("Žádné předplatné nenalezeno.");
    const origin = process.env.PUBLIC_APP_URL ?? "https://property-finder-pro-13.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/cenik`,
    });
    return { url: portal.url };
  });
