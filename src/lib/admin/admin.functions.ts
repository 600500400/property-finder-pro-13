import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  plan: "free" | "premium";
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

    const [subsRes, savedRes, aiMonthRes, aiActRes, alertsRes, activeWatchRes] = await Promise.all([
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

    if (subsRes.error) throw new Error(subsRes.error.message);
    if (savedRes.error) throw new Error(savedRes.error.message);
    if (aiMonthRes.error) throw new Error(aiMonthRes.error.message);

    const premiumSet = new Set<string>();
    for (const s of subsRes.data ?? []) {
      const active = (s.status === "active" || s.status === "trialing") &&
        (s.plan === "premium_monthly" || s.plan === "premium_yearly") &&
        s.current_period_end !== null && s.current_period_end > nowISO;
      if (active) premiumSet.add(s.user_id);
    }

    const watchdogCount = new Map<string, number>();
    for (const w of savedRes.data ?? []) {
      watchdogCount.set(w.user_id, (watchdogCount.get(w.user_id) ?? 0) + 1);
    }

    const aiMonthCount = new Map<string, number>();
    for (const a of aiMonthRes.data ?? []) {
      aiMonthCount.set(a.user_id, (aiMonthCount.get(a.user_id) ?? 0) + 1);
    }

    const userRows: AdminUserRow[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      plan: premiumSet.has(u.id) ? "premium" : "free",
      watchdogs: watchdogCount.get(u.id) ?? 0,
      ai_analyses_month: aiMonthCount.get(u.id) ?? 0,
    }));

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
