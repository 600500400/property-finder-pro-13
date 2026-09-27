import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, PLAN_PRICES, type PaidPlan } from "./stripe.server";
import {
  acquireBilling,
  releaseBilling,
  saveAttempt,
  type CheckoutAttempt,
} from "./operations.server";
import { billingOrigin } from "./config.server";

export async function startCheckout(userId: string, email: string | undefined, plan: PaidPlan) {
  const stripe = getStripe();
  const { token, attempt: persisted } = await acquireBilling(userId);
  let stored = persisted;
  try {
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, status, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Stav předplatného nelze načíst. Platba nebyla spuštěna.");
    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { metadata: { user_id: userId } },
        { idempotencyKey: `rs-customer-${userId}` },
      );
      customerId = customer.id;
      const { error: writeError } = await supabaseAdmin
        .from("subscriptions")
        .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
      if (writeError) throw new Error("Zákazníka nelze uložit. Platba nebyla spuštěna.");
      if (email) await stripe.customers.update(customerId, { email });
    }
    // Authoritative even with a delayed webhook; include past_due and incomplete.
    for await (const active of stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    })) {
      if (!["canceled", "incomplete_expired"].includes(active.status)) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: billingOrigin() + "/cenik",
        });
        return { url: portal.url };
      }
    }
    // Recover open sessions created by the pre-migration implementation too.
    // Close all but the recorded session before permitting another checkout.
    for await (const open of stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 100,
    })) {
      if (open.mode !== "subscription" || open.metadata?.user_id !== userId) continue;
      if (stored?.sessionId === open.id) continue;
      if (stored && !stored.sessionId && open.metadata.attempt_id === stored.id) {
        stored = { ...stored, sessionId: open.id };
        await saveAttempt(userId, token, stored);
        continue;
      }
      const previousPlan = open.metadata.plan;
      if (!stored && (previousPlan === "premium_monthly" || previousPlan === "premium_yearly")) {
        stored = {
          id: open.metadata.attempt_id || crypto.randomUUID(),
          plan: previousPlan,
          created: open.created * 1000,
          origin: billingOrigin(),
          sessionId: open.id,
        };
        await saveAttempt(userId, token, stored);
      } else {
        await stripe.checkout.sessions.expire(open.id);
      }
    }
    const create = async (attempt: CheckoutAttempt) => {
      const price = PLAN_PRICES[attempt.plan];
      return stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "czk",
                product_data: { name: `RealityScanner — ${price.label}` },
                unit_amount: price.amount,
                recurring: { interval: price.interval },
              },
            },
          ],
          subscription_data: { metadata: { user_id: userId, plan: attempt.plan } },
          metadata: { user_id: userId, plan: attempt.plan, attempt_id: attempt.id },
          success_url: attempt.origin + "/cenik?checkout=success",
          cancel_url: attempt.origin + "/cenik?checkout=cancel",
          allow_promotion_codes: true,
          locale: "cs",
        },
        { idempotencyKey: "rs-checkout-" + attempt.id },
      );
    };
    if (stored) {
      // Never blindly recreate an uncertain request beyond Stripe's idempotency retention.
      if (!stored.sessionId && Date.now() - stored.created >= 23 * 60 * 60 * 1000) {
        throw new Error(
          "Předchozí platbu je nutné ověřit. Kontaktujte podporu, novou platbu nezakládáme.",
        );
      }
      const previous = stored.sessionId
        ? await stripe.checkout.sessions.retrieve(stored.sessionId)
        : await create(stored);
      await saveAttempt(userId, token, { ...stored, sessionId: previous.id });
      if (previous.status === "complete") {
        const id =
          typeof previous.subscription === "string"
            ? previous.subscription
            : previous.subscription?.id;
        const oldSub = id ? await stripe.subscriptions.retrieve(id) : null;
        if (!oldSub || !["canceled", "incomplete_expired"].includes(oldSub.status)) {
          throw new Error("Platba již byla dokončena. Ověřujeme aktivaci Premium; neplaťte znovu.");
        }
      }
      if (previous.status === "open") {
        if (stored.plan === plan) return { url: previous.url };
        await stripe.checkout.sessions.expire(previous.id);
      } else if (previous.status !== "expired" && previous.status !== "complete") {
        throw new Error("Stav předchozí platby nelze ověřit.");
      }
    }
    const attempt: CheckoutAttempt = {
      id: crypto.randomUUID(),
      plan,
      created: Date.now(),
      origin: billingOrigin(),
    };
    await saveAttempt(userId, token, attempt);
    const session = await create(attempt);
    await saveAttempt(userId, token, { ...attempt, sessionId: session.id });
    return { url: session.url };
  } finally {
    await releaseBilling(userId, token);
  }
}

export async function openBillingPortal(userId: string) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Předplatné se nepodařilo načíst.");
  if (!sub?.stripe_customer_id) throw new Error("Žádné předplatné nenalezeno.");
  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: billingOrigin() + "/cenik",
  });
  return { url: portal.url };
}
