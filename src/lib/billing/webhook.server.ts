import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe } from "./stripe.server";
import { acquireBilling, releaseBilling } from "./operations.server";

const idOf = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value && typeof value.id === "string"
      ? value.id
      : undefined;

function subscriptionId(event: Stripe.Event): string | undefined {
  const object = event.data.object as unknown as {
    id?: string;
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
  };
  if (event.type.startsWith("customer.subscription.")) return object.id;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  )
    return idOf(object.subscription);
  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    return idOf(object.parent?.subscription_details?.subscription) ?? idOf(object.subscription);
  }
}

export async function processStripeEvent(event: Stripe.Event) {
  const id = subscriptionId(event);
  if (!id) return;
  const stripe = getStripe();
  const initial = await stripe.subscriptions.retrieve(id);
  const customerId = idOf(initial.customer);
  if (!customerId) throw new Error("Subscription has no customer");
  const { data: existing, error } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error("Customer lookup failed");
  let userId = existing?.user_id ?? initial.metadata.user_id;
  if (!userId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) userId = customer.metadata.user_id;
  }
  if (!userId) throw new Error("Cannot resolve subscription owner");

  const { token } = await acquireBilling(userId);
  try {
    // Re-read AFTER acquiring the lease: event delivery order is not authoritative.
    const sub = await stripe.subscriptions.retrieve(id);
    const { data: current, error: readError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error("Subscription lookup failed");
    if (current?.stripe_subscription_id && current.stripe_subscription_id !== id) {
      if (sub.status === "canceled") return;
      try {
        const replacement = await stripe.subscriptions.retrieve(current.stripe_subscription_id);
        if (replacement.created > sub.created) return;
        if (replacement.created === sub.created)
          throw new Error("Ambiguous subscription replacement; reconcile manually");
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("Ambiguous")) throw err;
      }
    }
    const interval = sub.items.data[0]?.price.recurring?.interval;
    const plan =
      sub.metadata.plan === "premium_monthly" || sub.metadata.plan === "premium_yearly"
        ? sub.metadata.plan
        : interval === "year"
          ? "premium_yearly"
          : interval === "month"
            ? "premium_monthly"
            : null;
    if (!plan) throw new Error("Unknown subscription plan");
    const legacy = sub as Stripe.Subscription & { current_period_end?: number };
    const period = sub.items.data[0]?.current_period_end ?? legacy.current_period_end;
    if (!period && ["active", "trialing"].includes(sub.status))
      throw new Error("Active subscription has no period end");
    const { error: writeError } = await supabaseAdmin.rpc("apply_stripe_subscription", {
      _user_id: userId,
      _token: token,
      _event_id: event.id,
      _snapshot: {
        id,
        customer: customerId,
        plan,
        status: sub.status,
        current_period_end: period ? new Date(period * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
    });
    if (writeError) throw new Error("Atomic subscription update failed");
  } finally {
    await releaseBilling(userId, token);
  }
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook unavailable", { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    await processStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      "[stripe-webhook] retry required",
      event.id,
      error instanceof Error ? error.message : "unknown",
    );
    return new Response("Processing failed; retry required", { status: 500 });
  }
}
