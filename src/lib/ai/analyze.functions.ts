import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { factsCacheKey, type FactFlag, type ListingFacts } from "./facts";
import { buildComparables, type ComparableSummary } from "./comparables";

const MODEL = "google/gemini-2.5-flash";
// Quota limits live in the DB function public.reserve_ai_analysis (premium 50/month, free 1 lifetime).
const TTL_DAYS = 30;

/** The client may only name the listing. Every fact is loaded server-side. */
const AnalyzeInput = z.object({
  listing_id: z.string().uuid(),
});

export type AIVerdict = "zvazit" | "opatrne" | "vyhnout";

/** Impersonal, shareable part of an analysis — this is what the shared cache stores. */
export interface AIFactualPayload {
  verdict: AIVerdict;
  true_cost_estimate?: number;
  yield_check: string;
  risks: string[];
  uncertainties: string[];
  broker_questions: string[];
  summary_cs: string;
}

export interface AIMetrics {
  own_ppm: number | null;
  median_ppm: number | null;
  pct_vs_median: number | null;
  sample_count: number;
  net_yield: number | null;
  gross_yield: number | null;
  rent_basis_label: string | null;
}

export interface AIAnalysisOk extends AIFactualPayload {
  ok: true;
  /** Deterministic, app-computed numbers — never taken from the model. */
  metrics: AIMetrics;
  price_position: { pct_vs_median: number; label: string } | null;
  /** Per-user, computed deterministically on the server; never cached shared. */
  user_rule_violations: string[];
  personal_notice: string | null;
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

const SYSTEM = `Jsi expert na české realitní investice. Buď stručný, věcný, žádná vata.
Odpovídej výhradně česky. Veškerý text ve výstupu musí být v češtině, nikdy anglicky.

Tvým úkolem je INTERPRETACE: příležitost, rizika, nejistoty a otázky na makléře.
Všechna čísla (medián Kč/m², Kč/m² nabídky, odchylka od mediánu, počet vzorků, výnos) jsou už spočítaná serverem a dostáváš je jako FAKTA.
NIKDY nepočítej vlastní medián, nepřepisuj dodané hodnoty a nevymýšlej falešně přesná čísla. Pokud data chybí, řekni to.
Nedostáváš žádná pravidla konkrétního uživatele — nepiš personalizovaná doporučení ani co „porušuje tvá pravidla".

Vrať PŘESNĚ tento JSON (žádný markdown, žádný komentář), vše česky:
{
  "verdict": "zvazit" | "opatrne" | "vyhnout",
  "true_cost_estimate": číslo v Kč | null,
  "yield_check": "1 věta, zda dodaný výnos vypadá realisticky",
  "risks": ["max 5 položek"],
  "uncertainties": ["max 4 položky — co z inzerátu nelze zjistit"],
  "broker_questions": ["max 5 konkrétních otázek na makléře"],
  "summary_cs": "2-3 věty obecného shrnutí bez personalizace"
}`;

function priceLabel(pct: number | null): { pct_vs_median: number; label: string } | null {
  if (pct == null) return null;
  return { pct_vs_median: pct, label: `${pct > 0 ? "+" : ""}${pct}% vs. medián srovnatelných nabídek` };
}

function buildPrompt(f: ListingFacts, comps: ComparableSummary, m: AIMetrics): string {
  return `INZERÁT (autoritativní serverová data)
- Zdroj: ${f.source}
- Název: ${f.title}
- Lokalita: ${f.city ?? "?"} (kraj: ${f.kraj ?? "?"})
- Typ: ${f.property_type ?? "?"} / ${f.deal_type ?? "?"}${f.house_subtype ? ` / ${f.house_subtype}` : ""}
- Cena: ${f.price.toLocaleString("cs-CZ")} Kč
- Plocha: ${f.area_m2 ?? "?"} m²${f.land_area_m2 ? `; pozemek ${f.land_area_m2} m²` : ""}
- Vlastnictví: ${f.ownership ?? "neuvedeno"}
- URL: ${f.url}

TEXT (snippet): ${f.description_snippet ?? "(žádný)"}

DETEKOVANÉ FLAGY: ${
    f.flags.length === 0
      ? "(žádné)"
      : f.flags.map(x => `[${x.category}:${x.code}] ${x.label}${x.snippet ? ` — ${x.snippet}` : ""}`).join("; ")
  }

SERVEREM SPOČÍTANÁ FAKTA (nepřepočítávej je):
- Kč/m² nabídky: ${m.own_ppm != null ? m.own_ppm.toLocaleString("cs-CZ") : "neznámé"}
- Medián Kč/m² způsobilého vzorku: ${m.median_ppm != null ? m.median_ppm.toLocaleString("cs-CZ") : "neznámé"}
- Odchylka od mediánu: ${m.pct_vs_median != null ? `${m.pct_vs_median > 0 ? "+" : ""}${m.pct_vs_median} %` : "neznámé"}
- Počet způsobilých srovnatelných nabídek: ${m.sample_count}
- Odhad výnosu: ${m.rent_basis_label ?? "neznámý základ"}; čistý ${m.net_yield ?? "?"} %, hrubý ${m.gross_yield ?? "?"} %

REPREZENTATIVNÍ VÝBĚR ZE VZORKU (rovnoměrně přes cenové rozložení, ne nejlevnější):
${comps.sample.length === 0
  ? "(nedostatek dat)"
  : comps.sample.map(c => `- ${c.city ?? "?"}: ${c.pricePerM2.toLocaleString("cs-CZ")} Kč/m² (${c.area_m2} m², ${c.price.toLocaleString("cs-CZ")} Kč)`).join("\n")}

Vrať JSON dle schématu.`;
}

export const analyzeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<AIAnalysisResult> => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Authoritative listing — every fact comes from the DB, never from the client.
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("listings")
      .select("id, source, title, price, deal_type, property_type, house_subtype, kraj, city, area_m2, land_area_m2, ownership, url, description_snippet, flags, is_active")
      .eq("id", data.listing_id)
      .maybeSingle();

    if (rowErr) return { ok: false, error: "ai_failed", message: "Nepodařilo se načíst inzerát." };
    if (!row || row.is_active !== true || !row.price) {
      return { ok: false, error: "ai_failed", message: "Inzerát už není dostupný." };
    }

    const facts: ListingFacts = {
      id: row.id as string,
      source: (row.source as string) ?? "",
      title: (row.title as string | null) ?? "",
      city: (row.city as string | null) ?? null,
      kraj: (row.kraj as string | null) ?? null,
      property_type: (row.property_type as string | null) ?? null,
      deal_type: (row.deal_type as string | null) ?? null,
      house_subtype: (row.house_subtype as string | null) ?? null,
      price: row.price as number,
      area_m2: (row.area_m2 as number | null) ?? null,
      land_area_m2: (row.land_area_m2 as number | null) ?? null,
      ownership: (row.ownership as string | null) ?? null,
      url: (row.url as string) ?? "",
      description_snippet: (row.description_snippet as string | null) ?? null,
      flags: Array.isArray(row.flags) ? (row.flags as unknown as FactFlag[]) : [],
    };

    // 2) Deterministic comparables — sample first, median from the whole sample.
    const candidateQ = supabaseAdmin
      .from("listings")
      .select("id, price, area_m2, city, kraj, property_type, deal_type, is_active")
      .eq("is_active", true)
      .not("price", "is", null)
      .not("area_m2", "is", null)
      .order("id", { ascending: true })
      .limit(2000);
    if (facts.kraj) candidateQ.eq("kraj", facts.kraj);
    if (facts.property_type) candidateQ.eq("property_type", facts.property_type);
    if (facts.deal_type) candidateQ.eq("deal_type", facts.deal_type);
    if (facts.area_m2 && facts.area_m2 > 0) {
      candidateQ.gte("area_m2", facts.area_m2 * 0.8).lte("area_m2", facts.area_m2 * 1.2);
    }
    const { data: candidates } = await candidateQ;
    const comps = buildComparables(facts, (candidates ?? []) as never, 8);

    // 3) Server-computed yield (never supplied by the client).
    let invest: { net_yield: number; gross_yield: number; rent_basis_label?: string } | null = null;
    if (facts.deal_type === "prodej" && facts.area_m2 && facts.area_m2 > 0) {
      const { getBenchmark } = await import("@/lib/scanner/rent-benchmark.server");
      const { indexRentComps, computeHybridYield } = await import("@/lib/listings/yield.server");
      const { data: rents } = await supabaseAdmin
        .from("listings")
        .select("kraj, property_type, area_m2, price")
        .eq("is_active", true)
        .eq("deal_type", "pronajem")
        .eq("kraj", facts.kraj ?? "")
        .eq("property_type", facts.property_type ?? "")
        .not("area_m2", "is", null)
        .not("price", "is", null);
      const bench = await getBenchmark();
      invest = computeHybridYield({
        price: facts.price,
        region: (facts.kraj ?? "") as never,
        propertyType: (facts.property_type ?? "ostatni") as never,
        areaM2: facts.area_m2,
        name: facts.title,
        locality: facts.city ?? "",
        ownership: (facts.ownership ?? undefined) as never,
        kraj: facts.kraj,
        bench,
        rentIndex: indexRentComps((rents ?? []) as never),
      });
    }

    const metrics: AIMetrics = {
      own_ppm: comps.own_ppm,
      median_ppm: comps.median_ppm,
      pct_vs_median: comps.pct_vs_median,
      sample_count: comps.sample_count,
      net_yield: invest?.net_yield ?? null,
      gross_yield: invest?.gross_yield ?? null,
      rent_basis_label: invest?.rent_basis_label ?? null,
    };

    // 4) Per-user rules — deterministic, no AI, never in the shared cache.
    const { evaluateInvestorRules, EMPTY_RULES } = await import("./personalize");
    const { data: rulesRow } = await supabaseAdmin
      .from("user_investor_rules")
      .select("excluded_localities, min_net_yield, max_price, require_osobni")
      .eq("user_id", userId)
      .maybeSingle();
    const personal = evaluateInvestorRules(
      {
        city: facts.city,
        kraj: facts.kraj,
        price: facts.price,
        ownership: facts.ownership,
        net_yield: metrics.net_yield,
      },
      rulesRow
        ? {
            excluded_localities: (rulesRow.excluded_localities as string[] | null) ?? [],
            min_net_yield: (rulesRow.min_net_yield as number | null) ?? null,
            max_price: (rulesRow.max_price as number | null) ?? null,
            require_osobni: !!rulesRow.require_osobni,
          }
        : EMPTY_RULES,
    );

    // 5) Shared impersonal cache lookup — a cache hit never consumes quota.
    const cacheKey = await factsCacheKey(facts);
    const { data: cached } = await supabaseAdmin
      .from("ai_analyses")
      .select("payload, created_at")
      .eq("url_hash", cacheKey)
      .maybeSingle();

    if (cached) {
      const ageDays = (Date.now() - new Date(cached.created_at as string).getTime()) / 86_400_000;
      if (ageDays < TTL_DAYS) {
        const p = cached.payload as unknown as AIFactualPayload;
        return {
          ok: true,
          ...p,
          metrics,
          price_position: priceLabel(metrics.pct_vs_median),
          ...personal,
          cached: true,
          cached_at: cached.created_at as string,
        };
      }
    }

    // 6) Atomic quota reservation (unchanged from Priorita 3).
    const { data: reservation, error: reserveErr } = await supabaseAdmin.rpc("reserve_ai_analysis", {
      _user_id: userId,
      _listing_id: facts.id,
    });
    const { mapReservation } = await import("./quota");
    const outcome = mapReservation(reservation as never, reserveErr);
    if (!outcome.ok) return outcome.error;

    // 7) Single AI call — impersonal interpretation only.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "ai_failed", message: "LOVABLE_API_KEY není nastaven" };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildPrompt(facts, comps, metrics) },
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
    let parsed: Partial<AIFactualPayload>;
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return { ok: false, error: "ai_failed", message: "AI vrátilo neplatné JSON." };
    }

    const verdict: AIVerdict = (["zvazit", "opatrne", "vyhnout"] as const).includes(parsed.verdict as AIVerdict)
      ? (parsed.verdict as AIVerdict)
      : "opatrne";

    const factual: AIFactualPayload = {
      verdict,
      true_cost_estimate: typeof parsed.true_cost_estimate === "number" ? parsed.true_cost_estimate : undefined,
      yield_check: typeof parsed.yield_check === "string" ? parsed.yield_check : "",
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5).map(String) : [],
      uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties.slice(0, 4).map(String) : [],
      broker_questions: Array.isArray(parsed.broker_questions) ? parsed.broker_questions.slice(0, 5).map(String) : [],
      summary_cs: typeof parsed.summary_cs === "string" ? parsed.summary_cs : "",
    };

    // 8) Persist the shared cache — impersonal payload only.
    await supabaseAdmin.from("ai_analyses").upsert({
      url_hash: cacheKey,
      url: facts.url,
      payload: factual as unknown as never,
      model: MODEL,
    });

    return {
      ok: true,
      ...factual,
      metrics,
      price_position: priceLabel(metrics.pct_vs_median),
      ...personal,
      usage: { used: outcome.used, limit: outcome.limit },
    };
  });
