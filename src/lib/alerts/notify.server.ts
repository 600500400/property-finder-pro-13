import type { SourceKey, DealType, PropertyType } from "@/lib/scanner/types";
import { matchesSearch, type MatchContext, type MatchListing, type SavedSearchRow } from "./match.server";
import { renderInstantEmail, renderDigestEmail, type EmailListing, type DigestSection } from "./email";
import { sendEmail } from "./resend.server";

const MAX_INSTANT_LISTINGS = 10;
const MAX_DIGEST_LISTINGS_PER_USER = 50;
const MAX_PER_SECTION = 10;

interface UserEmailRow {
  id: string;
  email: string | null;
}

async function loadCtx(): Promise<MatchContext> {
  const { getBenchmark } = await import("@/lib/scanner/rent-benchmark.server");
  const { indexRentComps } = await import("@/lib/listings/yield.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bench = await getBenchmark();
  const { data: rents } = await supabaseAdmin
    .from("listings")
    .select("kraj, property_type, area_m2, price")
    .eq("is_active", true)
    .eq("deal_type", "pronajem")
    .not("area_m2", "is", null)
    .not("price", "is", null);
  const rentIndex = indexRentComps((rents ?? []).map((r) => ({
    kraj: r.kraj, property_type: r.property_type, area_m2: r.area_m2 as number, price: r.price as number,
  })));
  return { bench, rentIndex };
}

async function userEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("id, email").in("id", userIds);
  const map = new Map<string, string>();
  for (const r of (data ?? []) as UserEmailRow[]) if (r.email) map.set(r.id, r.email);
  return map;
}

/** Post-scrape hook: match newly-inserted listings against active 'instant' searches. */
export async function processInstantAlerts(opts: {
  source: SourceKey;
  dealType: DealType;
  propertyType: PropertyType;
  newUrls: string[];
}): Promise<{ users_notified: number; emails_sent: number }> {
  if (opts.newUrls.length === 0) return { users_notified: 0, emails_sent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: searches } = await supabaseAdmin
    .from("saved_searches")
    .select("id, user_id, name, filters, min_yield, frequency, is_active")
    .eq("is_active", true)
    .eq("frequency", "instant");
  if (!searches || searches.length === 0) return { users_notified: 0, emails_sent: 0 };

  // Narrow searches to ones interested in this deal/property combo (skip cost otherwise)
  const candidate = (searches as unknown as SavedSearchRow[]).filter((s) => {
    const f = (s.filters ?? {}) as { deal_type?: string; property_type?: string; sources?: string[] };
    if (f.deal_type && f.deal_type !== opts.dealType) return false;
    if (f.property_type && f.property_type !== opts.propertyType) return false;
    if (Array.isArray(f.sources) && f.sources.length > 0 && !f.sources.includes(opts.source)) return false;
    return true;
  });
  if (candidate.length === 0) return { users_notified: 0, emails_sent: 0 };

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("source, title, price, deal_type, property_type, kraj, city, area_m2, ownership, url, image_url, first_seen_at")
    .in("url", opts.newUrls);
  if (!listings || listings.length === 0) return { users_notified: 0, emails_sent: 0 };

  const needYield = candidate.some((s) => s.min_yield != null);
  const ctx = needYield ? await loadCtx() : undefined;

  // Group matched listings by user, dedupe URLs
  const perUser = new Map<string, { name: string; searchId: string; items: EmailListing[]; urls: Set<string> }>();
  for (const s of candidate) {
    for (const l of listings as MatchListing[]) {
      if (!matchesSearch(l, s, ctx)) continue;
      let entry = perUser.get(s.user_id);
      if (!entry) {
        entry = { name: s.name, searchId: s.id, items: [], urls: new Set() };
        perUser.set(s.user_id, entry);
      }
      if (entry.urls.has(l.url)) continue;
      entry.urls.add(l.url);
      entry.items.push(l as EmailListing);
    }
  }
  if (perUser.size === 0) return { users_notified: 0, emails_sent: 0 };

  const emails = await userEmails([...perUser.keys()]);
  let sent = 0;
  for (const [userId, e] of perUser) {
    const to = emails.get(userId);
    if (!to) continue;
    const slice = e.items.slice(0, MAX_INSTANT_LISTINGS);
    const tpl = renderInstantEmail(e.name, slice);
    const result = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    await supabaseAdmin.from("email_log").insert({
      user_id: userId,
      search_id: e.searchId,
      listings_count: slice.length,
      status: result.ok ? "sent" : "error",
      error: result.error ?? null,
    });
    if (result.ok) {
      sent++;
      await supabaseAdmin
        .from("saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", e.searchId);
    }
  }
  return { users_notified: perUser.size, emails_sent: sent };
}

/** Daily digest: per active 'daily' search, find listings newer than last_notified_at, group per user. */
export async function processDailyDigest(): Promise<{ users_notified: number; emails_sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: searches } = await supabaseAdmin
    .from("saved_searches")
    .select("id, user_id, name, filters, min_yield, frequency, is_active, last_notified_at, created_at")
    .eq("is_active", true)
    .eq("frequency", "daily");
  if (!searches || searches.length === 0) return { users_notified: 0, emails_sent: 0 };

  const needYield = (searches as Array<{ min_yield: number | null }>).some((s) => s.min_yield != null);
  const ctx = needYield ? await loadCtx() : undefined;

  // Per-user buckets of DigestSection[]
  const perUser = new Map<string, { sections: DigestSection[]; searchIds: string[]; totalCount: number }>();

  for (const s of searches as unknown as Array<SavedSearchRow & { last_notified_at: string | null; created_at: string }>) {
    const since = s.last_notified_at ?? s.created_at;
    const f = (s.filters ?? {}) as Partial<{
      deal_type: string; property_type: string; region: string;
      sources: string[]; price_min: number; price_max: number;
    }>;

    let q = supabaseAdmin
      .from("listings")
      .select("source, title, price, deal_type, property_type, kraj, city, area_m2, ownership, url, image_url, first_seen_at")
      .eq("is_active", true)
      .gt("first_seen_at", since)
      .order("first_seen_at", { ascending: false })
      .limit(100);
    if (f.deal_type) q = q.eq("deal_type", f.deal_type);
    if (f.property_type) q = q.eq("property_type", f.property_type);
    if (f.region) q = q.eq("kraj", f.region);
    if (Array.isArray(f.sources) && f.sources.length > 0) q = q.in("source", f.sources);
    if (f.price_min != null) q = q.gte("price", f.price_min);
    if (f.price_max != null) q = q.lte("price", f.price_max);

    const { data: rows } = await q;
    if (!rows || rows.length === 0) continue;
    const matched = (rows as MatchListing[]).filter((l) => matchesSearch(l, s, ctx)).slice(0, MAX_PER_SECTION);
    if (matched.length === 0) continue;

    let bucket = perUser.get(s.user_id);
    if (!bucket) {
      bucket = { sections: [], searchIds: [], totalCount: 0 };
      perUser.set(s.user_id, bucket);
    }
    if (bucket.totalCount >= MAX_DIGEST_LISTINGS_PER_USER) continue;
    const remaining = MAX_DIGEST_LISTINGS_PER_USER - bucket.totalCount;
    const take = matched.slice(0, remaining);
    bucket.sections.push({ searchName: s.name, listings: take as EmailListing[] });
    bucket.searchIds.push(s.id);
    bucket.totalCount += take.length;
  }
  if (perUser.size === 0) return { users_notified: 0, emails_sent: 0 };

  const emails = await userEmails([...perUser.keys()]);
  const now = new Date().toISOString();
  let sent = 0;
  for (const [userId, b] of perUser) {
    const to = emails.get(userId);
    if (!to) continue;
    const tpl = renderDigestEmail(b.sections);
    const result = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
    await supabaseAdmin.from("email_log").insert({
      user_id: userId,
      search_id: b.searchIds[0] ?? null,
      listings_count: b.totalCount,
      status: result.ok ? "sent" : "error",
      error: result.error ?? null,
    });
    if (result.ok) {
      sent++;
      await supabaseAdmin
        .from("saved_searches")
        .update({ last_notified_at: now })
        .in("id", b.searchIds);
    }
  }
  return { users_notified: perUser.size, emails_sent: sent };
}
