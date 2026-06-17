# Investiční screening — plán

Dvouvrstvé hodnocení inzerátů. Layer 1 = levné regex flagy pro všechny. Layer 2 = AI verdikt (Gemini 2.5 Flash přes Lovable AI Gateway) pro premium, on-demand, cachované a s měsíčním limitem.

Poznámka: říkáš „Claude" v Layer 2, ale v cost-controls upřesňuješ Gemini 2.5 Flash přes Lovable AI Gateway (= aktuální stav, fakturace z Lovable kreditů). Držím se **Gemini 2.5 Flash** — žádný `ANTHROPIC_API_KEY` se nezavádí. Pokud chceš opravdu Claude, řekni a přepojím (potřeboval by se přidat klíč a billing mimo Lovable kredity).

---

## Layer 1 — regex/keyword flagy (zdarma, pro všechny)

### Detektor `src/lib/scanner/flags.ts`
Čistá funkce `detectFlags(listing, filters) → Flag[]`. Spouští se v `persist.server.ts` při každém upsertu z titulku + description_snippet + raw_data textových polí. Žádné HTTP, žádné AI.

Kategorie a klíčová slova (case-insensitive, diakritika tolerantní):
- **price_trap**: `anuita`, `doplat`, `+ provize`, `provize realitní kancelář`, `bez DPH`, `dražb`, `aukc`, `podíl ` / `spoluvlastnick`
- **foreign**: `španěl`, `chorvat`, `itáli`, `bulhar`, `řeck`, `zahranič`, `slovens` (jen pokud `kraj IS NULL`/lokalita nesedí na CZ)
- **type_nuance**: `družstevn`, `před rekonstrukcí`, `k rekonstrukci`, `obsazeno nájemníkem`, `nájemník v bytě`
- **discrepancy**: extrahuju z textu čísla u „m²" a u „Kč/mil.", porovnám se `price` a `area_m2`; pokud rozdíl >15 %, flag `discrepancy`

Tvar uložený do DB:
```json
{ "flags": [
  { "code": "anuita", "category": "price_trap", "label": "Anuita v textu", "snippet": "…doplatek anuity 380 000 Kč…" },
  { "code": "foreign_es", "category": "foreign", "label": "Možná zahraniční nemovitost", "snippet": "…apartmán ve Španělsku…" }
]}
```

### Schéma
Migrace přidá:
- `listings.flags jsonb not null default '[]'`
- GIN index `listings(flags jsonb_path_ops)` pro budoucí filtrování

### UI
- `ListingCard` zobrazí žluté chipy `⚠️ {label}` pod názvem (max 3, zbytek "+N").
- Když je přítomen `price_trap` flag, výnosové číslo (`net_yield`) se nezobrazí jako zelená hvězdička, ale jako `ověřit` s tooltipem „V textu detekován skrytý náklad (anuita/doplatek/provize) — výnos je orientační."
- TS typ `Flag` přidám do `src/lib/scanner/types.ts`.

---

## Layer 2 — AI investiční verdikt (premium, on-demand)

### Server function `analyzeListing` (přepis existujícího v `src/lib/ai/analyze.functions.ts`)
Middleware `requireSupabaseAuth`. Postup:

1. **Gate premium**: `is_premium(userId)` přes RPC; jinak vrať strukturovaný error `{ error: "premium_required" }`.
2. **Měsíční limit** (default 50/měs): spočítej řádky v nové tabulce `ai_analysis_usage` za aktuální měsíc; nad limit → `{ error: "monthly_limit_reached", used, limit }`.
3. **Cache** v `ai_analyses` keyed `sha256(listing.id + raw_data_hash)`; TTL stejné (30 dní). Cache hit **nečerpá** měsíční limit.
4. **Comparables**: 1 dotaz `listings` filtrovaný stejný `kraj` + `property_type` + `deal_type` + plocha ±20 %, max 8 řádků, jen `price, area_m2, city, url`. Spočítám medián `price/m²` a percentil dané nabídky.
5. **User rules**: načti `user_investor_rules` (vyloučené lokality, min_net_yield, max_price, povinná osobní vlastnictví ano/ne).
6. **Prompt** (tight — listing fields + flags + 8 comparables + user rules + median KPI), `response_format: json_object`. Žádný plný description, jen už uložený snippet.
7. Schema výstupu:
   ```ts
   {
     verdict: "zvazit" | "opatrne" | "vyhnout",
     price_position: { pct_vs_median: number, label: string }, // "-12 % pod srovnatelnou"
     true_cost_estimate?: number, // pokud anuita/doplatek detekován
     yield_check: string,
     risks: string[],
     user_rule_violations: string[],
     summary_cs: string
   }
   ```
8. Po úspěšném volání zapiš řádek do `ai_analysis_usage` a upsert do `ai_analyses`.

### Schéma (jedna migrace)
```sql
create table public.user_investor_rules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  excluded_localities text[] not null default '{}',
  min_net_yield numeric,
  max_price numeric,
  require_osobni boolean not null default false,
  updated_at timestamptz not null default now()
);
-- + GRANTs (authenticated CRUD vlastních, service_role all), RLS user_id = auth.uid()

create table public.ai_analysis_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.ai_analysis_usage (user_id, created_at desc);
-- + GRANTs (authenticated SELECT vlastních, service_role all), RLS
```

### Settings route `/_authenticated/nastaveni-investora`
- Formulář: textarea vyloučených lokalit (jedna na řádek), min net yield %, max cena, switch „pouze osobní vlastnictví".
- Server fn `getMyInvestorRules` / `saveMyInvestorRules`.
- Odkaz na settings se přidá do `UserMenu`.

### UI — `AIAnalysisDialog`
- Když server vrátí `premium_required` → CTA „Odemknout v Premium" (link na `/cenik`).
- Když vrátí `monthly_limit_reached` → text „Měsíční limit AI analýz vyčerpán ({used}/{limit}). Reset 1. dne v měsíci."
- Jinak nový layout verdiktu: barevný badge podle `verdict` (zelená/oranžová/červená), `price_position`, `risks`, `user_rule_violations` (pokud nějaké), `summary_cs`.
- Tlačítko „AI analýza" na kartě skryté pro free uživatele (zobrazím místo něj `<UpgradeBanner inline />`).

### Cost controls — souhrn
- ✅ Layer 2 jen pro premium, jen na klik
- ✅ Cache per listing (`raw_data hash`) — opakovaný klik kýmkoli = bez nákladu
- ✅ Měsíční limit 50/uživatel (konstanta `AI_MONTHLY_LIMIT`)
- ✅ Komprimovaný prompt (snippet + 8 comparables, ne celá DB)

---

## Technické detaily

**Soubory nové:**
- `src/lib/scanner/flags.ts` (detektor + typy)
- `src/lib/listings/investor-rules.functions.ts`
- `src/routes/_authenticated/nastaveni-investora.tsx`
- `supabase/migrations/<timestamp>_investor_screening.sql`

**Soubory upravené:**
- `src/lib/scanner/persist.server.ts` — zavolat `detectFlags` před upsertem, uložit do `row.flags`
- `src/lib/scanner/types.ts` — typ `Flag`, doplnit `flags?: Flag[]` na `Listing`
- `src/lib/scanner/scan-internal.server.ts` (nebo kde se mapuje DB→Listing) — propsat `flags` z DB do response
- `src/components/ListingCard.tsx` — chipy + výnos „ověřit"
- `src/components/AIAnalysisDialog.tsx` — nový layout + error stavy
- `src/lib/ai/analyze.functions.ts` — nová logika (premium gate, limit, comparables, user rules, nový prompt + schema)
- `src/components/UserMenu.tsx` — odkaz na settings
- `src/integrations/supabase/types.ts` — regenerace typů (auto po migraci)

**Nedotýkám se**: cron jobů, billing/Stripe flow, scraperů samotných (jen `persist.server.ts` rozšíření o `flags`).

**Out of scope** (pokud bys to chtěl, řekni):
- Backfill `flags` na existujících řádcích (nové scrapy je dopočítají; můžu přidat jednorázový script).
- Filtrování seznamu podle flagů v sidebaru.
- Vystavení Claude místo Gemini.

Pokračovat?
