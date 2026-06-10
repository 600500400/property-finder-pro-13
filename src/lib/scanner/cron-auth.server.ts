import { timingSafeEqual } from "crypto";

/**
 * Verify cron request via `Authorization: Bearer <CRON_SECRET>`.
 * The publishable apikey is NOT accepted — it's public in the browser bundle
 * and would allow anyone to trigger expensive scrapes.
 */
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const provided = m[1].trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
