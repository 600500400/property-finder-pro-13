import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MODEL = "google/gemini-2.5-flash";
const AI_MONTHLY_LIMIT = 50;
const TTL_DAYS = 30;

const Flag = z.object({
  code: z.string(),
  category: z.string(),
  label: z.string(),
  snippet: z.string().optional(),
});

const ListingInput = z.object({
  listing_id: z.string().uuid().optional(),
  source: z.string(),
  name: z.string(),
  locality: z.string(),
  url: z.string().url(),
  price: z.number(),
  area_m2: z.number().optional(),
  kraj: z.string().optional(),
  property_type: z.string().optional(),
  deal_type: z.string().optional(),
  ownership: z.string().optional(),
  description_snippet: z.string().optional(),
  flags: z.array(Flag).optional(),
  rent_basis_label: z.string().optional(),
  net_yield: z.number().optional(),
  gross_yield: z.number().optional(),
});

export type AIVerdict = "zvazit" | "opatrne" | "vyhnout";

export interface AIAnalysisOk {
  ok: true;
  verdict: AIVerdict;
  price_position: { pct_vs_median: number; label: string } | null;
  true_cost_estimate?: number;
  yield_check: string;
  risks: string[];
  user_rule_violations: string[];
  summary_cs: string;
  cached?: boolean;
  cached_at?: string;
  usage?: { used: number; limit: number };
}

export interface AIAnalysisErr {
  ok: false;
  error: "premium_required" | "free_sample_used" | "monthly_limit_reached" | "ai_failed";
  message: string;
  used?: number;
  limit?: number;
}

export type AIAnalysisResult = AIAnalysisOk | AIAnalysisErr;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM = `Jsi expert na české realitní investice. Buď stručný, věcný, žádná vata.
Odpovídej výhradně česky. Veškerý text ve výstupu (verdikt, rizika, doporučení) musí být v češtině, nikdy anglicky.
Vyhodnoť konkrétní nemovitost jako investici. K dispozici máš strukturovaná data, výňatek popisu, automaticky detekované varovné flagy a srovnatelné inzeráty (medián ceny/m²) ze stejného kraje a typu.
Posuď: férovost ceny vs. srovnání, odhad skutečné akviziční ceny vč. textem detekovaných nákladů (anuita, doplatek, provize, DPH), realističnost nájemního výnosu, hlavní rizika, a porušení pravidel uživatele (vyloučené lokality, min. výnos, max. cena, požadavek na osobní vlastnictví).

Vrať PŘESNĚ tento JSON (žádný markdown, žádný komentář). Všechny textové hodnoty MUSÍ být v češtině:
{
  "verdict": "zvazit" | "opatrne" | "vyhnout",
  "price_position": { "pct_vs_median": číslo (záporné=pod mediánem, kladné=nad), "label": "krátká česká věta" } | null,
  "true_cost_estimate": číslo v Kč | null,
  "yield_check": "1 česká věta zda výnos sedí",
  "risks": ["max 5 položek, česky"],
  "user_rule_violations": ["česky, pouze pokud opravdu porušuje uživatelská pravidla, jinak prázdné"],
  "summary_cs": "2-3 české věty celkového doporučení"
}`;

interface Comparable {
  price: number;
  area_m2: number;
  city: string | null;
  pricePerM2: number;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : Math.round((sorted[m - 1] + sorted[m]) / 2);
}

export const analyzeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListingInput.parse(input))
  .handler(async ({ data, context }): Promise<AIAnalysisResult> => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Cache lookup (per listing + raw fingerprint) — cached results never consume quota
    const fpInput = JSON.stringify({
      url: data.url, price: data.price, area: data.area_m2,
      flags: (data.flags ?? []).map(f => f.code).sort(),
      snippet: data.description_snippet ?? "",
    });
    const cacheKey = await sha256Hex(`${data.listing_id ?? data.url}|${fpInput}`);

    const { data: cached } = await supabaseAdmin
      .from("ai_analyses")
      .select("payload, created_at")
      .eq("url_hash", cacheKey)
      .maybeSingle();

    if (cached) {
      const ageDays = (Date.now() - new Date(cached.created_at as string).getTime()) / 86_400_000;
      if (ageDays < TTL_DAYS) {
        const p = cached.payload as unknown as Omit<AIAnalysisOk, "ok" | "cached" | "cached_at">;
        return { ok: true, ...p, cached: true, cached_at: cached.created_at as string };
      }
    }

    // 2) Atomic quota reservation (server-only RPC). Counts attempted analyses,
    // including uncertain provider failures — by design.
    if (!data.listing_id) {
      return { ok: false, error: "ai_failed", message: "Inzerát nelze analyzovat (chybí identifikátor)." };
    }

    const { data: reservation, error: reserveErr } = await supabaseAdmin.rpc("reserve_ai_analysis", {
      _user_id: userId,
      _listing_id: data.listing_id,
    });
    if (reserveErr) {
      return { ok: false, error: "ai_failed", message: "Nepodařilo se ověřit limit AI analýz." };
    }
    const res = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!res) {
      return { ok: false, error: "ai_failed", message: "Nepodařilo se ověřit limit AI analýz." };
    }

    const used = Number(res.used ?? 0);
    const quotaLimit = Number(res.quota_limit ?? 1);
    const isPremium = quotaLimit > 1;

    if (!res.allowed) {
      if (!isPremium) {
        return {
          ok: false,
          error: "free_sample_used",
          message: "Vyčerpal jsi svou jednu ukázkovou AI analýzu. Premium = 50 analýz měsíčně.",
          used, limit: quotaLimit,
        };
      }
      return {
        ok: false, error: "monthly_limit_reached",
        message: `Měsíční limit AI analýz vyčerpán (${used}/${quotaLimit}). Reset 1. dne v měsíci.`,
        used, limit: quotaLimit,
      };
    }

    // 3) Comparables (same kraj + property_type + deal_type + area ±20%)
    let comparables: Comparable[] = [];
    let medianPpm: number | null = null;
    if (data.kraj && data.property_type && data.deal_type && data.area_m2 && data.area_m2 > 0) {
      const aMin = data.area_m2 * 0.8;
      const aMax = data.area_m2 * 1.2;
      const { data: comps } = await supabaseAdmin
        .from("listings")
        .select("price, area_m2, city")
        .eq("is_active", true)
        .eq("kraj", data.kraj)
        .eq("property_type", data.property_type)
        .eq("deal_type", data.deal_type)
        .gte("area_m2", aMin)
        .lte("area_m2", aMax)
        .not("price", "is", null)
        .not("area_m2", "is", null)
        .neq("url", data.url)
        .limit(50);
      comparables = (comps ?? [])
        .filter(c => c.price && c.area_m2 && c.area_m2 > 0)
        .map(c => ({
          price: c.price as number,
          area_m2: c.area_m2 as number,
          city: c.city as string | null,
          pricePerM2: Math.round((c.price as number) / (c.area_m2 as number)),
        }))
        .sort((a, b) => a.pricePerM2 - b.pricePerM2)
        .slice(0, 8);
      medianPpm = median(comparables.map(c => c.pricePerM2));
    }

    // 5) User investor rules
    const { data: rulesRow } = await supabaseAdmin
      .from("user_investor_rules")
      .select("excluded_localities, min_net_yield, max_price, require_osobni")
      .eq("user_id", userId)
      .maybeSingle();
    const rules = {
      excluded_localities: (rulesRow?.excluded_localities as string[] | null) ?? [],
      min_net_yield: (rulesRow?.min_net_yield as number | null) ?? null,
      max_price: (rulesRow?.max_price as number | null) ?? null,
      require_osobni: !!rulesRow?.require_osobni,
    };

    // 6) Build tight prompt
    const ownPpm = data.area_m2 && data.area_m2 > 0 ? Math.round(data.price / data.area_m2) : null;
    const pctVsMedian = (ownPpm && medianPpm) ? Math.round(((ownPpm - medianPpm) / medianPpm) * 100) : null;

    const userMsg = `INZERÁT
- Zdroj: ${data.source}
- Název: ${data.name}
- Lokalita: ${data.locality} (kraj: ${data.kraj ?? "?"})
- Typ: ${data.property_type ?? "?"} / ${data.deal_type ?? "?"}
- Cena: ${data.price.toLocaleString("cs-CZ")} Kč${ownPpm ? ` (${ownPpm.toLocaleString("cs-CZ")} Kč/m²)` : ""}
- Plocha: ${data.area_m2 ?? "?"} m²
- Vlastnictví: ${data.ownership ?? "neuvedeno"}
- Náš odhad výnosu: ${data.rent_basis_label ?? "?"}; čistý ${data.net_yield ?? "?"}%, hrubý ${data.gross_yield ?? "?"}%
- URL: ${data.url}

TEXT (snippet): ${data.description_snippet ?? "(žádný)"}

DETEKOVANÉ FLAGY: ${
      (data.flags ?? []).length === 0
        ? "(žádné)"
        : (data.flags ?? []).map(f => `[${f.category}:${f.code}] ${f.label}${f.snippet ? ` — ${f.snippet}` : ""}`).join("; ")
    }

SROVNÁNÍ (stejný kraj+typ+plocha±20%, ${comparables.length} ks${medianPpm ? `, medián ${medianPpm.toLocaleString("cs-CZ")} Kč/m²` : ""}):
${comparables.length === 0
  ? "(nedostatek dat)"
  : comparables.map(c => `- ${c.city ?? "?"}: ${c.pricePerM2.toLocaleString("cs-CZ")} Kč/m² (${c.area_m2} m², ${c.price.toLocaleString("cs-CZ")} Kč)`).join("\n")}
${pctVsMedian != null ? `\nTato nabídka je ${pctVsMedian > 0 ? "+" : ""}${pctVsMedian}% vs. medián.` : ""}

PRAVIDLA UŽIVATELE:
- Vyloučené lokality: ${rules.excluded_localities.length ? rules.excluded_localities.join(", ") : "(žádné)"}
- Min. čistý výnos: ${rules.min_net_yield != null ? `${rules.min_net_yield}%` : "(neuvedeno)"}
- Max. cena: ${rules.max_price != null ? `${rules.max_price.toLocaleString("cs-CZ")} Kč` : "(neuvedeno)"}
- Pouze osobní vlastnictví: ${rules.require_osobni ? "ANO" : "ne"}

Vrať JSON dle schématu.`;

    // 7) AI call
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ai_failed", message: "LOVABLE_API_KEY není nastaven" };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return { ok: false, error: "ai_failed", message: "Příliš mnoho požadavků — zkus za chvíli." };
    if (resp.status === 402) return { ok: false, error: "ai_failed", message: "Vyčerpán AI kredit workspace." };
    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: "ai_failed", message: `AI selhalo (${resp.status}): ${t.slice(0, 200)}` };
    }

    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<AIAnalysisOk>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, error: "ai_failed", message: "AI vrátilo neplatné JSON." };
    }

    const verdict: AIVerdict = (["zvazit", "opatrne", "vyhnout"] as const).includes(parsed.verdict as AIVerdict)
      ? (parsed.verdict as AIVerdict)
      : "opatrne";

    const result: Omit<AIAnalysisOk, "ok" | "cached" | "cached_at"> = {
      verdict,
      price_position: parsed.price_position ?? (pctVsMedian != null ? {
        pct_vs_median: pctVsMedian,
        label: `${pctVsMedian > 0 ? "+" : ""}${pctVsMedian}% vs. medián srovnatelných`,
      } : null),
      true_cost_estimate: parsed.true_cost_estimate ?? undefined,
      yield_check: typeof parsed.yield_check === "string" ? parsed.yield_check : "",
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5).map(String) : [],
      user_rule_violations: Array.isArray(parsed.user_rule_violations)
        ? parsed.user_rule_violations.slice(0, 5).map(String)
        : [],
      summary_cs: typeof parsed.summary_cs === "string" ? parsed.summary_cs : "",
    };

    // 8) Persist cache + usage
    await supabaseAdmin.from("ai_analyses").upsert({
      url_hash: cacheKey,
      url: data.url,
      payload: result as unknown as never,
      model: MODEL,
    });
    await supabaseAdmin.from("ai_analysis_usage").insert({
      user_id: userId,
      listing_id: data.listing_id ?? null,
    });

    return {
      ok: true,
      ...result,
      usage: isPremium
        ? { used: used + 1, limit: AI_MONTHLY_LIMIT }
        : { used: 1, limit: 1 },
    };
  });
