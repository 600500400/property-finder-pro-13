## Plán nápravy – 4 oblasti

### 0) Předpoklad: Lovable Cloud + přihlášení
Pro scheduler, ukládání filtrů a posílání emailů zapneme **Lovable Cloud** a přihlašování **email + heslo** (volitelně Google). Vytvoříme `profiles` tabulku (pokud bude potřeba) a tabulky `saved_filters`, `scheduled_scans`, `scan_results`, `scan_email_log` s RLS politikami (každý vidí jen své záznamy).

### 1) Odstranění obrázků, důraz na data
- Z `Listing` typu odstraníme zobrazení `img` v `ListingCard` (pole v datech necháme pro budoucnost, jen ho přestaneme renderovat).
- Karta se přepracuje na text-first layout: **název / lokalita+čtvrť / cena / plocha / Kč/m² / yield / typ vlastnictví / datum / zdroj / badges**.
- Ze scraperů odstraníme práci s obrázky (urychlí to Sreality, Annonce, Bezrealitky atd.) – HEAD requesty na obrázky v testu odpadnou.
- Plánuje to vyřešit jak Hyperinzerce/Annonce/iDnes prázdné obrázky, tak konzistenci napříč zdroji.

### 2) Filtr „typ vlastnictví"
- Do `FilterSidebar` přidáme MultiSelect: **osobní / družstevní / státní / jiné / neznámé**.
- `ScanFilters` rozšíříme o `ownership: Ownership[]`.
- Filtrování proběhne **klientsky** (data už máme z parserů – `ownership` pole už existuje), aby fungovalo i na již naskenovaných inzerátech.
- V `ListingCard` zobrazíme typ vlastnictví jako badge (už částečně je).

### 3) Anti-balast: jen ČR + sanity checks
- Nový modul `src/lib/scanner/sanity.ts` s funkcí `isCzechListing(listing)`:
  - Whitelist CZ klíčových slov / krajů / měst (~200 položek).
  - Blacklist: „Španělsko", „Itálie", „Bulharsko", „Chorvatsko", „Slovensko", „Rakousko", „Německo", „Turecko", „Kypr", „Thajsko", „Egypt", „UAE", „Dubai", měna `EUR/€` v ceně bez kontextu, atd.
  - Detekce přes `locality + name + url` (např. `sreality.cz/zahranicni-reality/`).
- Volá se v `scan.functions.ts` po sloučení výsledků; vyřazené jdou do `diagnostics.filtered_foreign` (počet) místo do listu.
- Současně doplníme `filtered_invalid_url` a `filtered_no_price` čítače pro transparentnost.

### 4) AI investiční rádce (MVP)
- Tlačítko **„AI analýza"** na kartě inzerátu otevře dialog.
- Server function `analyzeListing` (TanStack `createServerFn`) volá **Lovable AI Gateway** (`google/gemini-3-flash-preview`) s payloadem inzerátu + lokalitou + naším yield benchmarkem.
- Prompt instruuje model, aby vrátil JSON: `{ lokalita_summary, rizika[], sociodemografie, doporuceni, score_1_10 }`.
- Výsledek se cachuje v tabulce `ai_analyses` (klíč = URL inzerátu, TTL 30 dní), aby se neopakovaly náklady.
- UI render markdown přes `react-markdown` (už dostupné).
- Poznámka: MVP nepoužívá externí datasety vyloučených lokalit – model pracuje jen se svými znalostmi + našimi daty. Vylepšení (MV ČR registry, ČSÚ data) v dalším kroku.

### 5) Scheduler s emailem
- Stránka **`/saved`** (chráněná `_authenticated`):
  - Uložit aktuální filtr jako pojmenovaný preset.
  - U presetu zapnout scheduler: frekvence (`1× / 2× / 3× denně`), emailová adresa, max počet nových inzerátů v emailu.
- Tabulky:
  - `saved_filters (id, user_id, name, filters_jsonb, created_at)`
  - `scheduled_scans (id, user_id, filter_id, frequency, email, enabled, last_run_at, next_run_at)`
  - `scan_results (id, scheduled_scan_id, listing_url, listing_jsonb, first_seen_at)` – pro deduplikaci.
- Server route `/api/public/cron/run-schedules` (chráněná HMAC sdíleným tajemstvím `CRON_SECRET`):
  - Načte due schedulers, spustí scan, dedup proti `scan_results`, pošle email s **jen novými** inzeráty.
- pg_cron job v Supabase volá tento endpoint každých 30 min.
- **Lovable Emails**: použijeme zabudované `email_domain--setup_email_infra` + `scaffold_transactional_email`, šablona `daily-scan-report.tsx` s top 10 inzeráty (jen text, bez obrázků – konzistentní s bodem 1).
- Vyžaduje od uživatele: ověření emailové domény (průvodce v UI).

### Soubory
**Nové:** `src/lib/scanner/sanity.ts`, `src/lib/ai/analyze.functions.ts`, `src/routes/_authenticated/saved.tsx`, `src/routes/auth.tsx`, `src/routes/api/public/cron/run-schedules.ts`, `src/lib/email-templates/daily-scan-report.tsx`, `src/components/AIAnalysisDialog.tsx`, migrace pro 4 nové tabulky + RLS.
**Upravené:** `ListingCard.tsx` (odstranění obrázku, AI tlačítko, ownership badge), `FilterSidebar.tsx` (ownership filtr), `scan.functions.ts` (sanity volání, čítače), `types.ts` (ownership[] ve filtrech), všechny `sources/*.ts` (vypustit `img` práci), `routes/index.tsx` (klientský ownership filter), `__root.tsx` (auth provider link).
**Smazané:** HEAD image check ve `tests/e2e/scanner-detail-urls.test.ts`.

### Pořadí prací
1. Lovable Cloud + auth + migrace tabulek.
2. Odstranění obrázků + ownership filtr (rychlé wins).
3. Sanity filtr (jen ČR).
4. Saved filters + scheduler UI.
5. Email infrastruktura + cron endpoint.
6. AI analýza dialog.

### Otevřené otázky (vyřeším default ve build módu, pokud neřekneš jinak)
- Doména pro emaily – nastaví se v průvodci po zapnutí Cloudu.
- AI model – default `google/gemini-3-flash-preview` (rychlý, levný); pro hloubku lze přepnout na `gemini-2.5-pro`.
- Frekvence cronu kontroly schedulerů – 30 min (pokrývá 1×/2×/3× denně).
