import { createHash } from "crypto";

/**
 * Stable per-source identifier for a listing URL.
 * 1) If the URL ends with a numeric segment (>=4 digits), use it.
 * 2) Otherwise normalize URL (strip query/hash, lowercase host, trim trailing slash)
 *    and use first 16 chars of SHA1 hex.
 */
export function deriveExternalId(source: string, url: string): string {
  if (!url) return `${source}:empty:${Math.random().toString(36).slice(2, 10)}`;
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const m = segments[i].match(/(\d{4,})/);
      if (m) return m[1];
    }
    // Some listing URLs carry the id only as a query param (e.g. Sreality
    // "…/hledani/prodej/dum?id=2462675788"); without this every such URL
    // would hash to the same value and collapse into one row.
    const qid = u.searchParams.get("id");
    if (qid && /^\d{4,}$/.test(qid)) return qid;
    const normalized = `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
    return createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  } catch {
    return createHash("sha1").update(url).digest("hex").slice(0, 16);
  }
}
