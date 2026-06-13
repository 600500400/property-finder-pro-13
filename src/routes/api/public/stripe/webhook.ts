import { createFileRoute } from "@tanstack/react-router";

type StripeSub = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number | null;
  cancel_at_period_end: boolean;
  items: { data: Array<{ current_period_end?: number | null; price: { recurring: { interval: string } | null } }> };
  metadata: Record<string, string>;
};

async function planFromSub(sub: StripeSub): Promise<"premium_monthly" | "premium_yearly" | null> {
  const meta = sub.metadata?.plan;
  if (meta === "premium_monthly" || meta === "premium_yearly") return meta;
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === "year") return "premium_yearly";
  if (interval === "month") return "premium_monthly";
  return null;
}

async function upsertFromSubscription(sub: StripeSub) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getStripe } = await import("@/lib/billing/stripe.server");

  // user_id resolution: subscription metadata → customer metadata → existing row
  let userId: string | undefined = sub.metadata?.user_id;
  if (!userId) {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(sub.customer);
    if (!("deleted" in customer)) userId = customer.metadata?.user_id;
  }
  if (!userId) {
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", sub.customer)
      .maybeSingle();
    userId = row?.user_id ?? undefined;
  }
  if (!userId) {
    console.warn("[stripe-webhook] no user_id for subscription", sub.id);
    return;
  }

  const plan = (await planFromSub(sub)) ?? "premium_monthly";
  // Stripe API 2026-05-27 (dahlia) moved current_period_end from the subscription
  // to the subscription item. Read item first, fall back to legacy field.
  const cpeUnix = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
  const cpe = cpeUnix ? new Date(cpeUnix * 1000).toISOString() : null;

  const uid: string = userId;
  await supabaseAdmin.from("subscriptions").upsert({
    user_id: uid,
    plan,
    status: sub.status,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    current_period_end: cpe,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  }, { onConflict: "user_id" });
}

async function markFree(customerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ plan: "free", status: "canceled", cancel_at_period_end: false })
    .eq("stripe_customer_id", customerId);
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const { getStripe } = await import("@/lib/billing/stripe.server");
        const stripe = getStripe();

        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (err) {
          console.error("[stripe-webhook] signature verify failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as { subscription?: string };
              if (session.subscription) {
                const sub = await stripe.subscriptions.retrieve(session.subscription);
                await upsertFromSubscription(sub as unknown as StripeSub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.resumed":
            case "customer.subscription.paused":
              await upsertFromSubscription(event.data.object as unknown as StripeSub);
              break;
            case "customer.subscription.deleted": {
              const sub = event.data.object as unknown as StripeSub;
              await markFree(sub.customer);
              break;
            }
            case "invoice.payment_failed": {
              const inv = event.data.object as { subscription?: string };
              if (inv.subscription) {
                const sub = await stripe.subscriptions.retrieve(inv.subscription);
                await upsertFromSubscription(sub as unknown as StripeSub);
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
