## A) Rychlé opravy (Stage 1 follow-up)

### 1. Oprava filtru „Typ vlastnictví"
Problém: scrapery zatím nenastavují `listing.ownership`, takže jakýkoli aktivní filtr odfiltruje vše (`l.ownership` je `undefined`).

Řešení v `src/routes/index.tsx`:
- Položka „Neurčeno / jiné" (`jine`) bude matchovat i `undefined`.
- Pokud `ownership` není detekováno z parseru, pokusíme se ho odvodit ad-hoc z `name + locality` (regex `OV / DV / osobní / družstevní`) ve `scan.functions.ts` (po sanity, před návratem).

V scraperech (Sreality, Bezrealitky, Bazoš, Hyperinzerce, Annonce, iDnes) doplníme volání `parseOwnership(name + " " + locality + " " + description?)` při mapování — máme už helper ve `valuation.ts`.

Akceptace: zapnutím „Družstevní" zůstanou jen DV; „Neurčeno" ukáže i položky bez detekce; přepínání filtru nevyžaduje nový sken.

### 2. Okresní (district-level) referenční nájem
Místo krajského průměru použít průměr z konkrétního **okresu** (77 okresů ČR + 22 pražských obvodů).

Implementace v `src/lib/scanner/rent-benchmark.server.ts`:
- Nový loader `refreshBenchmark()` udělá denně 1× lehký scrape Sreality search API (`category_type_cb=2 / pronajem`, `category_main_cb=1 / byty`, `per_page=100`, paginace ~5 stránek na okres přes `locality_district_id`).
- Spočítá `median(price / area_m2)` per okres (medián > průměr, ignoruje outliery, min. 8 platných vzorků).
- Fallback do statické tabulky `RENT_PER_M2_DISTRICT` (Deloitte 2024) když nedostatek dat.
- Cache 24 h v `globalThis` (už existuje) + persist do souboru `/tmp/rent-bench.json` aby přežil HMR.
- Meta v `ScanResult` rozšířit o `benchmark_okresy_filled: number` a `benchmark_okresy_fallback: number`.

Úprava `valuation.ts`:
- `districtSlugFromLocality()` rozšířit o detekci 77 okresů (mapa `OKRES_SLUGS`, parsování `okres X` / city → okres přes lookup tabulku).
- Prefer order: Praha-N / Brno-část / Plzeň-N / Ostrava-část → okres → kraj → ČR.
- `RentResult.basisLabel` ukáže např. „Okres Beroun: 245 Kč/m² (medián z 124 inzerátů, Sreality)".
- `rent_source` rozšířit o `"district_live" | "district_static" | "region" | "fallback"`.

Karta inzerátu (`ListingCard`) — drobná úprava textu zdroje, aby uživatel viděl „okres Beroun (živá data)" vs „kraj (fallback)".

---

## B) Fáze 2 — Cloud, Auth, Scheduler, AI rádce

### 3. Zapnutí Lovable Cloud + Auth
- Aktivovat Lovable Cloud (Supabase pod kapotou — uživateli říkáme „Cloud").
- Auth: **email + heslo** (default), zapnout HIBP password check.
- Tabulka `profiles (id uuid PK fk auth.users, email text, created_at)` + trigger pro auto-insert na signup.
- Stránka `/auth` (sign-in / sign-up), pathless layout `/_authenticated/` pro chráněné stránky (klient-side gate `ssr:false`).
- V hlavičce aplikace zobrazit „Přihlásit / Odhlásit / Můj profil".

### 4. Schéma databáze
Migrace (vše s explicitními GRANT + RLS):

- `saved_filters` — uložené presety filtrů na účet (název, JSON `filters`, vytvořeno).
- `scheduled_scans` — `saved_filter_id`, `frequency` (1×/2×/3× denně), `email`, `max_per_email`, `enabled`, `last_run_at`.
- `scan_results` — historie spuštění (`scheduled_scan_id`, `ts`, `count`, `results jsonb`, `meta jsonb`).
- `scan_email_log` — log odeslaných emailů.
- `ai_analyses` — cache AI rozborů (`url_hash` PK, `payload jsonb`, `created_at`), TTL 30 dní.

RLS: čtení/zápis jen `user_id = auth.uid()`; cron beží jako `service_role`.

### 5. Stránka `/saved` (chráněná)
- Seznam uložených presetů + možnost spustit ručně, zapnout scheduler, nastavit email a frekvenci.
- Tlačítko „Uložit aktuální filtr" v sidebaru migruje localStorage presety do DB pro přihlášené.

### 6. Scheduler + cron + email
- Server route `app/routes/api/public/cron/run-schedules.ts`:
  - Verifikace HMAC sekretem `CRON_SECRET`.
  - Vybere `scheduled_scans` které mají běžet (podle `last_run_at` + `frequency`).
  - Pro každý: zavolá interní `runScan(filters)`, uloží do `scan_results`, pošle email s top N (text-only, žádné obrázky).
- pg_cron volá endpoint každých 30 min.
- Emaily přes **Lovable Emails** (built-in): `email_domain--check_email_domain_status` → pokud chybí, dialog `presentation-open-email-setup`. Pak `setup_email_infra` + `scaffold_transactional_email` → React Email template `daily-scan-report.tsx` (značka, top inzeráty s názvem, cenou, čtvrtí, výnosem, linkem).

### 7. AI investiční rádce (MVP)
- Tlačítko „AI analýza" na `ListingCard` → modal `AIAnalysisDialog`.
- Server fn `analyzeListing` (`src/lib/ai/analyze.functions.ts`):
  - Vstup: celý `Listing` + okresní benchmark.
  - Volá Lovable AI Gateway, model `google/gemini-2.5-flash` (rychlý, zdarma v promo).
  - Prompt: shrň lokalitu, sociodemografii (obecně), rizika (vyloučená lokalita, povodňová zóna — z veřejně známých dat), zhodnoť výnos vs benchmark, doporuč 1–10.
  - Výstup JSON `{lokalita, rizika[], sociodemo, doporuceni, score}` přes `inputValidator` zod.
  - Cache v `ai_analyses` na 30 dní (klíč = SHA256 z `url + price`).
- Vyžaduje `LOVABLE_API_KEY` (`ai_gateway--create`).

---

## Technické detaily

### Soubory — nové
- `supabase/migrations/<ts>_phase2_cloud.sql` (tabulky + RLS + GRANT)
- `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/saved.tsx`
- `src/routes/api/public/cron/run-schedules.ts`
- `src/lib/ai/analyze.functions.ts`, `src/components/AIAnalysisDialog.tsx`
- `src/emails/daily-scan-report.tsx`
- `src/lib/scanner/okresy.ts` (mapa 77 okresů + city→okres)

### Soubory — upravené
- `src/lib/scanner/rent-benchmark.server.ts` — live scrape per okres + medián
- `src/lib/scanner/valuation.ts` — okresní lookup, nový `rent_source`
- `src/lib/scanner/types.ts` — rozšířený `RentBasisSource`, meta okres counters
- `src/lib/scanner/scan.functions.ts` — odvození ownership z textu pokud chybí
- `src/routes/index.tsx` — `jine` matchuje `undefined`
- `src/routes/__root.tsx` — auth state listener, header sign-in/out
- `src/lib/scanner/sources/*.server.ts` — naplnit `ownership` při mapování

### Pořadí implementace (přírůstkové)
1. Opravy A1 + A2 (rychlé, zlepší okamžitě UX).
2. `supabase--enable` → migrace + Auth UI (`/auth`, `_authenticated`).
3. Saved filters + `/saved` stránka.
4. Email infra (dialog → setup → template).
5. Scheduler cron endpoint + pg_cron.
6. AI rádce.

---

## Otevřené otázky / předpoklady
- Email: počítám s **vestavěnými Lovable Emails** (potvrzeno minulou volbou). Doménu nastaví uživatel v dialogu (může běžet i během vývoje, emaily se zatím nepošlou).
- Cron interval cílím na **každých 30 min** (granularita stačí pro 1–3× denně). OK?
- Live scrape benchmarku je „best-effort": při chybě Sreality API spadne na statickou tabulku — uživatel uvidí v Diagnostics.

Po schválení začnu A1+A2 a hned navážu na zbytek fáze 2.
