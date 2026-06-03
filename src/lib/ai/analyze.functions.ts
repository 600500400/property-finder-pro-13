import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

const ListingInput = z.object({
  source: z.string(),
  name: z.string(),
  locality: z.string(),
  url: z.string().url(),
  price: z.number(),
  area_m2: z.number().optional(),
  ownership: z.string().optional(),
  rent_basis_label: z.string().optional(),
  net_yield: z.number().optional(),
  gross_yield: z.number().optional(),
});

export interface AIAnalysis {
  lokalita: string;
  rizika: string[];
  sociodemo: string;
  doporuceni: string;
  score: number; // 1-10
  cached?: boolean;
  cached_at?: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const SYSTEM = `Jsi expert na české realitní investice. Odpovídej STRUČNĚ česky, věcně, bez vaty.
Zhodnoť konkrétní nemovitost: lokalitu, rizika (vyloučená lokalita, povodňová zóna, sociální problémy, hluk, doprava), sociodemografii (obecně, nikoli osobní data), a srovnej výnos s tržním benchmarkem.
Vrať PŘESNĚ JSON formátu (žádné markdown bloky, žádný komentář):
{"lokalita":"1-3 věty o lokalitě","rizika":["max 4 položky"],"sociodemo":"1-2 věty","doporuceni":"1-2 věty doporučení","score":číslo 1-10}`;

const TTL_DAYS = 30;

export const analyzeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListingInput.parse(input))
  .handler(async ({ data }): Promise<AIAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY není nastaven");

    const hash = await sha256Hex(`${data.url}|${data.price}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cache lookup
    const { data: cached } = await supabaseAdmin
      .from("ai_analyses")
      .select("payload, created_at")
      .eq("url_hash", hash)
      .maybeSingle();

    if (cached) {
      const ageDays = (Date.now() - new Date(cached.created_at as string).getTime()) / 86_400_000;
      if (ageDays < TTL_DAYS) {
        const p = cached.payload as unknown as AIAnalysis;
        return { ...p, cached: true, cached_at: cached.created_at as string };
      }
    }

    const userMsg = `Inzerát:
- Zdroj: ${data.source}
- Název: ${data.name}
- Lokalita: ${data.locality}
- Cena: ${data.price.toLocaleString("cs-CZ")} Kč
- Plocha: ${data.area_m2 ?? "?"} m²
- Vlastnictví: ${data.ownership ?? "neuvedeno"}
- Náš odhad: ${data.rent_basis_label ?? "?"}; čistý výnos: ${data.net_yield ?? "?"}%, hrubý: ${data.gross_yield ?? "?"}%
- URL: ${data.url}

Vyhodnoť investici. Vrať pouze JSON.`;

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
    if (resp.status === 429) throw new Error("Příliš mnoho požadavků na AI — zkus za chvíli.");
    if (resp.status === 402) throw new Error("Vyčerpán AI kredit — doplň v nastavení.");
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI selhalo (${resp.status}): ${t.slice(0, 200)}`);
    }
    const json: any = await resp.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: AIAnalysis;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI vrátilo neplatné JSON");
    }

    // Sanity defaults
    parsed.rizika = Array.isArray(parsed.rizika) ? parsed.rizika.slice(0, 4) : [];
    parsed.score = Math.max(1, Math.min(10, Number(parsed.score) || 5));

    // Save cache
    await supabaseAdmin.from("ai_analyses").upsert({
      url_hash: hash,
      url: data.url,
      payload: parsed as unknown as never,
      model: MODEL,
    });

    return parsed;
  });
