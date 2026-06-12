import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key, { apiVersion: "2025-09-30.clover" });
  return _stripe;
}

export const PLAN_PRICES = {
  premium_monthly: { amount: 34900, interval: "month" as const, label: "Premium měsíčně" },
  premium_yearly: { amount: 349000, interval: "year" as const, label: "Premium ročně" },
};
export type PaidPlan = keyof typeof PLAN_PRICES;
