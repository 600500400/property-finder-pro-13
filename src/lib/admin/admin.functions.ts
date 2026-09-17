import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: "free" | "premium";
  premium_source: "stripe" | "manual" | null;
  /** ISO date; null = unlimited (manual) or unknown */
  premium_until: string | null;
  granted_by_email: string | null;
  granted_at: string | null;
  watchdogs: number;
  ai_analyses_month: number;
}

export interface AdminDashboardData {
  totals: {
    users: number;
    premium: number;
    free: number;
    conversion_pct: number;
  };
  activity_30d: {
    active_watchdogs: number;
    alerts_sent: number;
    ai_analyses: number;
  };
  users: AdminUserRow[];
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboardData> => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch all auth users (paginate up to 10k)
    const users: Array<{ id: string; email: string; created_at: string; last_sign_in_at: string | null }> = [];
    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        users.push({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < perPage) break;
    }

    const nowISO = new Date().toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartISO = monthStart.toISOString();

    const [manualRes, subsRes, savedRes, aiMonthRes, aiActRes, alertsRes, activeWatchRes] = await Promise.all([
      supabaseAdmin
        .from("manual_premium_grants")
        .select("user_id, manual_premium_until, granted_by_email, granted_at, revoked_at"),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, status, current_period_end"),
      supabaseAdmin.from("saved_searches").select("user_id, is_active"),
      supabaseAdmin
        .from("ai_analysis_usage")
        .select("user_id, created_at")
        .gte("created_at", monthStartISO),
      supabaseAdmin
        .from("ai_analysis_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30d),
      supabaseAdmin
        .from("email_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30d)
        .eq("status", "sent"),
      supabaseAdmin
        .from("saved_searches")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (manualRes.error) throw new Error(manualRes.error.message);
    if (subsRes.error) throw new Error(subsRes.error.message);
    if (savedRes.error) throw new Error(savedRes.error.message);
    if (aiMonthRes.error) throw new Error(aiMonthRes.error.message);

    type ManualInfo = { until: string | null; by: string | null; at: string };
    const manualMap = new Map<string, ManualInfo>();
    for (const g of manualRes.data ?? []) {
      const active =
        g.revoked_at === null &&
        (g.manual_premium_until === null || g.manual_premium_until > nowISO);
      if (active) {
        manualMap.set(g.user_id, {
          until: g.manual_premium_until,
          by: g.granted_by_email,
          at: g.granted_at,
        });
      }
    }

    const stripeEnd = new Map<string, string | null>();
    const premiumSet = new Set<string>();
    for (const s of subsRes.data ?? []) {
      const active = (s.status === "active" || s.status === "trialing") &&
        (s.plan === "premium_monthly" || s.plan === "premium_yearly") &&
        s.current_period_end !== null && s.current_period_end > nowISO;
      if (active) {
        premiumSet.add(s.user_id);
        stripeEnd.set(s.user_id, s.current_period_end);
      }
    }

    const watchdogCount = new Map<string, number>();
    for (const w of savedRes.data ?? []) {
      watchdogCount.set(w.user_id, (watchdogCount.get(w.user_id) ?? 0) + 1);
    }

    const aiMonthCount = new Map<string, number>();
    for (const a of aiMonthRes.data ?? []) {
      aiMonthCount.set(a.user_id, (aiMonthCount.get(a.user_id) ?? 0) + 1);
    }

    const userRows: AdminUserRow[] = users.map((u) => {
      const manual = manualMap.get(u.id);
      const stripe = premiumSet.has(u.id);
      const source: AdminUserRow["premium_source"] = stripe ? "stripe" : manual ? "manual" : null;
      return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      plan: stripe || manual ? "premium" : "free",
      premium_source: source,
      premium_until: stripe ? (stripeEnd.get(u.id) ?? null) : (manual?.until ?? null),
      granted_by_email: manual?.by ?? null,
      granted_at: manual?.at ?? null,
      watchdogs: watchdogCount.get(u.id) ?? 0,
      ai_analyses_month: aiMonthCount.get(u.id) ?? 0,
      };
    });

    const total = userRows.length;
    const premium = userRows.filter((u) => u.plan === "premium").length;
    const free = total - premium;
    const conversion = total > 0 ? (premium / total) * 100 : 0;

    return {
      totals: {
        users: total,
        premium,
        free,
        conversion_pct: Math.round(conversion * 10) / 10,
      },
      activity_30d: {
        active_watchdogs: activeWatchRes.count ?? 0,
        alerts_sent: alertsRes.count ?? 0,
        ai_analyses: aiActRes.count ?? 0,
      },
      users: userRows,
    };
  });

/** Verify the caller is an admin; returns the caller's id and email. */
async function requireAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
  userId: string;
  claims: Record<string, unknown>;
}): Promise<{ userId: string; email: string | null }> {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
  const email = typeof context.claims?.["email"] === "string" ? (context.claims["email"] as string) : null;
  return { userId: context.userId, email };
}

export type GrantMonths = 1 | 3 | 12 | null;

/** Admin-only: grant Premium manually (no Stripe involved). months=null → unlimited. */
export const grantManualPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; months: GrantMonths; note?: string }) => {
    if (!input?.user_id || typeof input.user_id !== "string") throw new Error("user_id required");
    if (input.months !== null && ![1, 3, 12].includes(input.months as number)) {
      throw new Error("months must be 1, 3, 12 or null");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let until: string | null = null;
    if (data.months !== null) {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() + data.months);
      until = d.toISOString();
    }

    const { error } = await supabaseAdmin.from("manual_premium_grants").upsert(
      {
        user_id: data.user_id,
        manual_premium_until: until,
        granted_by: admin.userId,
        granted_by_email: admin.email,
        granted_at: new Date().toISOString(),
        revoked_at: null,
        note: data.note ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, manual_premium_until: until };
  });

/** Admin-only: revoke a manual Premium grant (keeps the audit row). */
export const revokeManualPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("manual_premium_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin-only: trigger Sreality houses backfill by region. */
export const triggerHousesBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: "morava" | "all" | string }) => {
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { runSourceScrape } = await import("@/lib/scanner/persist.server");
    const MORAVA = ["jihomoravsky", "moravskoslezsky", "olomoucky", "zlinsky"];
    const ALL = [
      "jihomoravsky", "moravskoslezsky", "olomoucky", "zlinsky",
      "praha", "stredocesky", "jihocesky", "plzensky", "karlovarsky",
      "ustecky", "liberecky", "kralovehradecky", "pardubicky", "vysocina",
    ];
    const targets = data.scope === "morava" ? MORAVA : data.scope === "all" ? ALL : [data.scope];
    const results = [];
    for (const reg of targets) {
      try {
        const res = await runSourceScrape("sreality", "prodej", "domy", reg);
        results.push(res);
      } catch (err) {
        results.push({
          source: "sreality",
          deal_type: "prodej",
          property_type: "domy",
          region: reg,
          status: "error",
          items_found: 0,
          items_new: 0,
          items_updated: 0,
          items_deactivated: 0,
          duration_ms: 0,
          run_id: "",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const totalFound = results.reduce((acc, r) => acc + (r.items_found || 0), 0);
    const totalNew = results.reduce((acc, r) => acc + (r.items_new || 0), 0);
    const totalUpdated = results.reduce((acc, r) => acc + (r.items_updated || 0), 0);
    return { ok: true, targets, totalFound, totalNew, totalUpdated, results };
  });

