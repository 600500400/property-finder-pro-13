import { timingSafeEqual } from "crypto";

/**
 * Verify cron request. Per Lovable convention, /api/public/* bypasses auth on
 * published sites; we additionally check the `apikey` header matches the
 * project's publishable key as a basic guard against accidental triggers.
 * pg_cron sends it as `apikey: <SUPABASE_PUBLISHABLE_KEY>`.
 */
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return false;
  const provided = request.headers.get("apikey") || "";
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
