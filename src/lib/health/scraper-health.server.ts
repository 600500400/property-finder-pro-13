import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ACTIVE_SOURCES } from "@/lib/scanner/active-sources";

export interface SourceHealth {
  source: string;
  last_status: "success" | "error" | "running" | "unknown";
  last_started_at: string | null;
  last_finished_at: string | null;
  last_items_found: number | null;
  last_error: string | null;
  baseline_median: number | null;
  successful_runs_24h: number;
  drop_pct: number | null; // % drop vs baseline (positive number = how much it dropped)
  indicator: "green" | "amber" | "red";
  reasons: string[];
}

// Monitor only currently active sources. Paused sources are excluded from
// the filter UI (single source of truth: src/lib/scanner/active-sources.ts)
// and therefore must produce zero health alerts.
const KNOWN_SOURCES: readonly string[] = ACTIVE_SOURCES;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function computeScraperHealth(): Promise<SourceHealth[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: runs, error } = await supabaseAdmin
    .from("scrape_runs")
    .select("source,status,started_at,finished_at,items_found,error_message")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const bySource = new Map<string, typeof runs>();
  for (const s of KNOWN_SOURCES) bySource.set(s, [] as never);
  for (const r of runs ?? []) {
    // Skip rows from paused/unknown sources — they must not produce alerts.
    if (!bySource.has(r.source)) continue;
    const arr = bySource.get(r.source) ?? [];
    arr.push(r as never);
    bySource.set(r.source, arr as never);
  }

  const now = Date.now();
  const result: SourceHealth[] = [];
  for (const [source, list] of bySource.entries()) {
    const rows = (list ?? []) as Array<{
      source: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      items_found: number;
      error_message: string | null;
    }>;

    // Ignore in-progress runs — a source mid-scrape must never trigger an alert.
    const completed = rows.filter((r) => r.status !== "running");
    const last = completed[0] ?? null;
    const successful = rows.filter((r) => r.status === "success");
    const recentSuccess = successful.slice(0, 10).map((r) => r.items_found);
    const baseline = median(recentSuccess);
    const successful24h = successful.filter(
      (r) => now - new Date(r.started_at).getTime() < 24 * 3600 * 1000,
    ).length;

    const reasons: string[] = [];
    let indicator: "green" | "amber" | "red" = "green";
    let dropPct: number | null = null;

    if (!last) {
      reasons.push("Žádné běhy v posledních 7 dnech");
      indicator = "red";
    } else {
      if (last.status === "error") {
        reasons.push(`Poslední běh selhal: ${last.error_message ?? "neznámá chyba"}`);
        indicator = "red";
      }
      if (last.items_found === 0 && baseline !== null && baseline > 0) {
        reasons.push(`items_found=0, baseline=${baseline}`);
        indicator = "red";
      }
      if (baseline !== null && baseline > 0 && last.items_found > 0) {
        dropPct = ((baseline - last.items_found) / baseline) * 100;
        if (dropPct > 60) {
          reasons.push(`Pokles o ${dropPct.toFixed(0)}% vs baseline (${last.items_found} vs ${baseline})`);
          indicator = "red";
        } else if (dropPct > 30) {
          reasons.push(`Pokles o ${dropPct.toFixed(0)}% vs baseline`);
          if (indicator === "green") indicator = "amber";
        }
      }
      if (successful24h === 0) {
        reasons.push("Žádný úspěšný běh za posledních 24 h");
        indicator = "red";
      }
    }

    result.push({
      source,
      last_status: (last?.status as SourceHealth["last_status"]) ?? "unknown",
      last_started_at: last?.started_at ?? null,
      last_finished_at: last?.finished_at ?? null,
      last_items_found: last?.items_found ?? null,
      last_error: last?.error_message ?? null,
      baseline_median: baseline,
      successful_runs_24h: successful24h,
      drop_pct: dropPct,
      indicator,
      reasons,
    });
  }
  return result;
}

const ADMIN_EMAIL = "kamelpost@gmail.com";

export async function sendHealthAlert(unhealthy: SourceHealth[]): Promise<{ sent: number; errors: string[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, errors: ["RESEND_API_KEY missing"] };
  const errors: string[] = [];
  let sent = 0;
  for (const h of unhealthy) {
    const subject = `⚠️ RealityScanner: zdroj ${h.source} hlásí problém`;
    const body = [
      `Zdroj: ${h.source}`,
      `Stav posledního běhu: ${h.last_status}`,
      `Spuštěn: ${h.last_started_at ?? "—"}`,
      `items_found: ${h.last_items_found ?? "—"}`,
      `baseline (medián 10 úspěšných): ${h.baseline_median ?? "—"}`,
      `úspěšných běhů za 24h: ${h.successful_runs_24h}`,
      h.drop_pct !== null ? `Pokles vs baseline: ${h.drop_pct.toFixed(0)} %` : "",
      h.last_error ? `Chyba: ${h.last_error}` : "",
      "",
      "Důvody:",
      ...h.reasons.map((r) => ` - ${r}`),
    ].filter(Boolean).join("\n");
    const html = `<pre style="font-family:monospace;font-size:13px;line-height:1.5">${body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "RealityScanner <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          subject,
          text: body,
          html,
        }),
      });
      if (!res.ok) errors.push(`${h.source}: ${res.status} ${await res.text().catch(() => "")}`);
      else sent++;
    } catch (e) {
      errors.push(`${h.source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { sent, errors };
}
