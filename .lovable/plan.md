# Priorita 4 — autoritativní data pro AI, neutrální comparables, oddělení personalizace

## Zjištěný stav (ověřeno čtením kódu)

Tři body Priority 4 zatím splněné nejsou:

1. **Server stále věří údajům z klienta.** `analyzeListing` přijímá `price`, `kraj`, `area_m2`, `property_type`, `deal_type`, `ownership`, `locality`, `flags` a `url` z prohlížeče a používá je jak v promptu, tak jako filtry pro comparables. Serverově se podle `listing_id` načítá jen kontrola existence uvnitř rezervační funkce kvóty.
2. **Comparables nejsou statisticky neutrální.** Dotaz vezme 50 řádků bez deterministického řazení, setřídí je podle Kč/m², **ořízne na 8 nejlevnějších** a medián počítá až z tohoto oříznutého výběru.
3. **Sdílená cache obsahuje osobní věci.** Klíč cache je jen fingerprint nabídky (bez `user_id`, bez pravidel), ale payload obsahuje `user_rule_violations` a personalizované `summary_cs`. Tabulka `ai_analyses` má navíc `GRANT SELECT` a policy `USING (true)` pro `authenticated`, takže kterýkoli přihlášený uživatel si může z prohlížeče přečíst cizí payload včetně jeho pravidel.

## Co se udělá

### 1. Autoritativní načtení nabídky na serveru

- Vstup serverové funkce zúžit na `{ listing_id }` (volitelně `rent_basis_label`/výnosy jen jako zobrazovací kontext — nikoliv jako vstup do metrik; pokud je nepotřebujeme, odstraní se úplně a výnos se dopočítá serverově z uložených dat).
- Podle `listing_id` načíst přes service role řádek z `listings` (`price, area_m2, kraj, city, property_type, deal_type, ownership, house_subtype, url, title, description_snippet, flags, is_active`) a všechny další výpočty i prompt staví výhradně z něj.
- Neaktivní nebo neexistující nabídka → čitelná chyba, žádné AI volání.
- `AIAnalysisDialog.tsx` posílá už jen `listing_id` (guard na chybějící id zůstává).

### 2. Deterministické, neutrální comparables

Nový čistý modul `src/lib/ai/comparables.ts` (bez DB, testovatelný):

- vstup: autoritativní nabídka + seznam kandidátů;
- vzorek: stejný kraj, `property_type`, `deal_type`, plocha ±20 %, `is_active`, platná cena i plocha, vyloučení vlastní nabídky podle `id`;
- medián Kč/m² se počítá z **celého** způsobilého vzorku;
- z něj se pro prompt vybere deterministický reprezentativní podvzorek (max ~8 nabídek rovnoměrně přes setříděné rozložení + prostředek), stabilní řazení podle `(pricePerM2, id)` — nezávislý na pořadí vstupu;
- metriky `median_ppm`, `own_ppm`, `pct_vs_median`, `sample_count` počítá aplikace; AI je dostává jako hotová fakta.

Dotaz na kandidáty dostane stabilní `order` a vyšší limit, aby vzorek nebyl závislý na pořadí z DB.

### 3. Rozdělení cache na neosobní fakta a osobní doporučení

- `factsHash` = hash autoritativních dat nabídky + verze promptu → sdílená cache `ai_analyses` obsahuje **jen** neosobní část: verdikt bez uživatelských pravidel, cenová pozice, kontrola výnosu, obecná rizika, neutrální souhrn, deterministické metriky. Žádné `user_id`, žádná pravidla, žádné `user_rule_violations`.
- personalizovaná část (porušení pravidel + finální doporučení) se cachuje pod klíčem `factsHash + user_id + rulesHash` (stabilní hash normalizovaných pravidel) v nové tabulce `ai_analyses_personal`.
- změna pravidel uživatele mění `rulesHash` → invaliduje jen jeho personalizované záznamy; sdílená fakta zůstávají.
- staré záznamy `ai_analyses` (mohou obsahovat osobní obsah) se nepoužijí: bump verze promptu v hashi + jednorázové smazání starých řádků v migraci.

### 4. Oprávnění AI cache (DB migrace — ano, je nutná)

Jedna aditivní migrace:

- `REVOKE SELECT ON public.ai_analyses FROM authenticated`, zrušit policy `ai_analyses_read_authenticated` a nahradit ji restriktivní „server-only" (stejný vzor jako `listings`); service role dál plný přístup;
- nová tabulka `public.ai_analyses_personal (facts_hash text, user_id uuid, rules_hash text, payload jsonb, model text, created_at timestamptz, PK(facts_hash,user_id,rules_hash))` — RLS zapnutá, čtení jen vlastní řádek pro `authenticated` (čte se ale výhradně serverem), zápis service role;
- `DELETE FROM public.ai_analyses` pro staré potenciálně osobní payloady (destruktivní krok, vyžádá si potvrzení — jde jen o cache, znovu se naplní);
- po migraci se regenerují Supabase typy.

### 5. Prompt

AI dostane deterministická čísla jako fakta a instrukci je nepřepisovat; její rolí je interpretace příležitosti, rizik, nejistot a otázek na makléře. Dvě části výstupu: neosobní (sdílené) a personalizované vyhodnocení pravidel.

## Testy (jen mocky, žádné živé AI volání)

Nový `tests/ai-analysis.test.ts` + rozšíření existujících:

- klient nemůže podvrhnout cenu / kraj / typ / plochu — vstup se ignoruje, použije se DB řádek;
- medián comparables je nezávislý na pořadí vstupu a nepočítá se z nejlevnějších nabídek;
- dva uživatelé, stejná nabídka, jiná pravidla → různý personalizovaný cache klíč a různý výsledek;
- změna pravidel invaliduje jen personalizovanou cache daného uživatele;
- sdílený factual payload neobsahuje `user_id`, pravidla ani `user_rule_violations`;
- browser nesmí čít `ai_analyses` (dotaz anon/authenticated klientem je zamítnut).

Spustí se `node node_modules/typescript/bin/tsc --noEmit --pretty false` a `node node_modules/vitest/vitest.mjs run`.

## Mimo rozsah

Stripe, billing, hlídací psi, obecné vyhledávání, redesign dialogu, AI chat, refactor Priority 3.
