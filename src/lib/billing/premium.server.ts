/**
 * Single source of truth for premium status.
 * All gates (queryListings, saved_searches, instant alerts, CSV) MUST go through here.
 * No status logic is duplicated elsewhere — see public.is_premium() RPC for the rule.
 */
import { getRequest } from "@tanstack/react-start/server";

/** Admin check by user id. Uses the SECURITY DEFINER `is_premium` RPC. */
export async function isUserPremium(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_premium", { _user_id: userId });
  if (error) {
    console.error("[premium] is_premium rpc error", error);
    return false;
  }
  return data === true;
}

/** Best-effort: read user id from the current request's bearer token (no throw on anon). */
export async function viewerUserId(): Promise<string | null> {
  try {
    const req = getRequest();
    const auth = req?.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

/** Convenience: true if the current request's caller is premium. Anonymous → false. */
export async function viewerIsPremium(): Promise<boolean> {
  const uid = await viewerUserId();
  return isUserPremium(uid);
}
