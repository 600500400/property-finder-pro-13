# Priorita 4 — autoritativní data pro AI, neutrální comparables, oddělení personalizace

## Zjištěný stav (ověřeno čtením kódu)

Tři body Priority 4 zatím splněné nejsou:

1. **Server stále věří údajům z klienta.** `analyzeListing` přijímá `price`, `kraj`, `area_m2`, `property_type`, `deal_type`, `ownership`, `locality`, `flags` a `url` z prohlížeče a používá je jak v promptu, tak jako filtry pro comparables. Serverově se podle `listing_id` kontroluje jen existence nabídky uvnitř rezervační funkce kvóty.
2. **Comparables nejsou statisticky neutrální.** Dotaz vezme 50 řádků bez deterministického řazení, setřídí je podle Kč/m², **ořízne na 8 nejlevnějších** a medián počítá až z tohoto oříznutého výběru.
3. **Sdílená cache obsahuje osobní věci.** Klíč cache je jen fingerprint nabídky (bez `user_id`, bez pravidel), ale payload obsahuje `user_rule_violations` a personalizované `summary_cs`. Tabulka `ai_analyses` má navíc `GRANT SELECT` a policy `USING (true)` pro `authenticated`, takže kterýkoli přihlášený uživatel si může z prohlížeče přečíst cizí payload.

## Co se udělá

### 1. Autoritativní načtení nabídky na serveru

- Vstup serverové funkce je **výhradně `{ listing_id: uuid }`**. Žádné ceny, plochy, URL, výnosy ani „zobrazovací kontext" z klienta.
- Podle `listing_id` se přes service role načte řádek z `listings` (`id, price, area_m2, land_area_m2, kraj, city, property_type, deal_type, ownership, house_subtype, url, title, description_snippet, flags, is_active`) a všechny výpočty i prompt staví výhradně z něj.
- Výnosové ukazatele (hrubý/čistý výnos, základ nájmu) se dopočítají serverově z uložených dat stávající serverovou logikou výnosu.
- Neaktivní nebo neexistující nabídka → čitelná chyba, žádné AI volání.
- `AIAnalysisDialog.tsx` posílá jen `listing_id`; guard na chybějící id zůstává. Zobrazení výsledku přebírá čísla z odpovědi serveru.

### 2. Deterministické, neutrální comparables

Nový čistý modul `src/lib/ai/comparables.ts` (bez DB, testovatelný):

- vstup: autoritativní nabídka + seznam kandidátů;
- způsobilý vzorek: stejný kraj, `property_type`, `deal_type`, plocha ±20 %, `is_active`, platná cena i plocha, vyloučení vlastní nabídky podle `id`;
- medián Kč/m² se počítá z **celého** způsobilého vzorku;
- pro prompt se z něj vybere deterministický reprezentativní podvzorek (max ~8 položek rovnoměrně přes setříděné rozložení včetně okolí mediánu), stabilní řazení podle `(pricePerM2, id)` — nezávislé na pořadí vstupu z DB;
- metriky `median_ppm`, `own_ppm`, `pct_vs_median`, `sample_count` počítá aplikace; AI je dostává jako hotová fakta a nesmí je přepisovat.

Dotaz na kandidáty dostane stabilní `order` a vyšší limit, aby vzorek nezávisel na pořadí z DB.

### 3. Rozdělení: jedno AI volání, sdílená neosobní fakta + serverová personalizace

- **Jedno placené AI volání**, žádné druhé kolo pro personalizaci.
- AI vrací pouze **neosobní interpretaci**: verdikt, cenová pozice slovně, kontrola výnosu, obecná rizika, nejistoty, otázky na makléře, neutrální souhrn. V promptu ani ve výstupu nejsou uživatelská pravidla.
- Tento neosobní výsledek + deterministické metriky se cachují sdíleně v `ai_analyses` pod klíčem `factsHash` = hash autoritativních dat nabídky + verze schématu/promptu.
- **Porušení investičních pravidel a personalizované upozornění se počítá deterministicky na serveru** (nový čistý modul `src/lib/ai/personalize.ts`) z: autoritativní nabídky + společných metrik + aktuálních pravidel uživatele. Žádné AI, tedy nic k cachování per-user; skládá se při každém požadavku znovu.
- Tím pádem **nová tabulka není potřeba** — `ai_analyses_personal` se nezakládá.
- Staré řádky `ai_analyses` (mohly obsahovat osobní obsah) se **nemažou**. Nová verze v hashi (cache namespace, např. prefix `v2|`) je prostě nikdy netrefí, takže se nikdy nevrátí jinému uživateli. Případné mazání navrhnu samostatně až po záloze a výslovném potvrzení.
- Cache hit zůstává **před** rezervací kvóty; atomická rezervace z Priority 3 se nemění.

### 4. Prompt

Deterministická čísla jdou do promptu jako serverem vypočtená fakta s instrukcí je nepřepočítávat. Rolí AI je interpretace příležitosti, rizik, nejistot a otázek pro makléře — ne určování mediánu ani produkce falešně přesných čísel.

## Přesný seznam migračních změn

Jedna migrace, jen oprávnění, nic destruktivního, žádné mazání dat, žádná nová tabulka:

1. `DROP POLICY IF EXISTS "ai_analyses_read_authenticated" ON public.ai_analyses;`
2. `REVOKE ALL PRIVILEGES ON TABLE public.ai_analyses FROM PUBLIC, anon, authenticated;`
3. `GRANT ALL PRIVILEGES ON TABLE public.ai_analyses TO service_role;`
4. `ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;` (idempotentní)
5. `CREATE POLICY ai_analyses_server_only ON public.ai_analyses AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);`

Tj. stejný server-only vzor jako u `listings`. Po migraci se regenerují Supabase typy.

## Testy (jen mocky, žádné živé AI volání)

Nový `tests/ai-analysis.test.ts` + rozšíření existujících:

- klient nemůže podvrhnout cenu / kraj / typ / plochu — vstupní schéma je jen `listing_id`, použije se DB řádek;
- medián comparables je nezávislý na pořadí vstupu a nepočítá se z nejlevnějších nabídek;
- dva uživatelé, stejná nabídka, jiná pravidla → různé porušení pravidel a různé personalizované upozornění, přičemž sdílený cache záznam je jeden a stejný;
- změna pravidel uživatele mění jen jeho personalizovanou část, sdílená fakta zůstávají platná;
- sdílený factual payload neobsahuje `user_id`, pravidla ani `user_rule_violations`;
- starý cache záznam z předchozí verze se nikdy netrefí (namespace v klíči);
- browser nesmí čít `ai_analyses` (dotaz klientskou rolí je zamítnut).

Spustí se `node node_modules/typescript/bin/tsc --noEmit --pretty false` a `node node_modules/vitest/vitest.mjs run`.

## Mimo rozsah

Stripe, billing, hlídací psi, obecné vyhledávání, redesign dialogu, AI chat, refactor Priority 3, mazání staré cache.
