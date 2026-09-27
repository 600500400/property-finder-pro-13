import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaidPlan } from "./stripe.server";

export type CheckoutAttempt = {
  id: string;
  plan: PaidPlan;
  created: number;
  origin: string;
  sessionId?: string;
};

export async function acquireBilling(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("acquire_billing_operation", {
    _user_id: userId,
  });
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.token !== "string"
  ) {
    throw new Error("Platbu právě zpracováváme nebo není dostupná. Zkuste to prosím za chvíli.");
  }
  return { token: data.token, attempt: data.attempt as CheckoutAttempt | null };
}
export async function saveAttempt(userId: string, token: string, attempt: CheckoutAttempt) {
  const { error } = await supabaseAdmin.rpc("save_billing_attempt", {
    _user_id: userId,
    _token: token,
    _attempt: attempt,
  });
  if (error) throw new Error("Nepodařilo se bezpečně uložit stav platby.");
}
export async function releaseBilling(userId: string, token: string) {
  const { error } = await supabaseAdmin.rpc("release_billing_operation", {
    _user_id: userId,
    _token: token,
  });
  if (error) console.error("[billing] lease release failed", error.code);
}
