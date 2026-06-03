# Plán: data zveřejnění, detail URL, district nájem, cache, re-sort

## 1. Povinné `published_at` u všech zdrojů + fallback + logging

Cíl: každý `Listing` má vždy `published_at` (ISO) a víme, odkud datum pochází.

- Rozšířit `Listing` o `published_at_source?: "api" | "html" | "estimated" | "fallback_now"` (jen pro diagnostiku, v UI tooltipem).
- V každém scraperu (`sreality`, `bazos`, `bezrealitky`, `annonce`, `hyperinzerce`, `firecrawl` = idnes/realitymix):
  - Zkusit nativní pole (pořadí dle zdroje — viz aktuální fallbacky).
  - Pokud chybí → zkusit z detailu (heuristika: regex `dnes|včera|před X dny|DD.MM.YYYY` v textu karty).
  - Pokud stále chybí → `published_at = now()`, `published_at_source = "fallback_now"`.
  - Logovat per zdroj: `console.log("[scanner:<src>] dates: api=X html=Y fallback=Z")`.
- Diagnostika v `scan.functions.ts`: do `Diagnostic` přidat `dates_from: { api, html, fallback }` a vykreslit v `DiagnosticsBar` (malý text).
- V `ListingCard` u dat z `fallback_now` ukázat datum kurzívou s tooltipem „Datum nebylo k dispozici — zobrazen čas skenu".

## 2. Detail URL inzerátu (ne kategorie) + obrázky — audit per zdroj

Pro každý zdroj zkontrolovat regex/parsing detail URL a obrázku. Akce per zdroj:

- **Sreality**: URL skládat z `hash_id` → `https://www.sreality.cz/detail/<deal>/<type>/<seo_locality>/<hash_id>`. Obrázek z `_links.images[0].href` nebo `_embedded.images[0]._links.self.href`, sanitizace template `{width}`.
- **Bazoš**: URL přímo z `<a class="nadpis">`; obrázek z `<img class="obrazek">` (ne placeholder `noimg`).
- **Bezrealitky**: URL `https://www.bezrealitky.cz/nemovitosti-byty-domy/<uri>`; obrázek z `mainImage.url` (přidat fallback `gallery[0].url`).
- **Annonce**: zachovat aktuální detail regex; obrázek z `<a class="thumbnail"> <img>`.
- **Hyperinzerce**: detail z `data-link`; obrázek `c-ad-list__item-image`.
- **iDnes / RealityMix (Firecrawl)**: zpřísnit prompt: `detail_url` musí obsahovat `/detail/` nebo numerické ID; post-filter zahodit URL bez ID. Obrázek musí být z karty (ne logo).
- Přidat unit-test–style `assert`: pokud `url` nematchuje povolený regex per source → zahodit listing (a započítat do `diagnostic.dropped`).
- Vykreslit v UI badge „⚠ detail URL nedostupné" pouze jako fallback.

## 3. District-level (čtvrť / městská část) odhad nájemného

- Rozšířit tabulku v `valuation.ts`:
  - Přidat `RENT_PER_M2_DISTRICT: Record<string, number>` se slugy typu `praha-1`, `praha-9`, `brno-stred`, `plzen-3`, atd. (cca 60 položek — Praha 1–22, krajská města + okresy).
  - Nová funkce `rentPerM2(region, locality, district?)`:
    1. Pokud `district` známé → vrátit district hodnotu.
    2. Jinak parsovat `locality` regexem (`Praha 9`, `Brno-střed`, `Plzeň 3`) a zkusit lookup.
    3. Fallback → krajská hodnota.
- `Investment` rozšířit o `rent_source: "district" | "region" | "fallback"` a `rent_basis_label` (např. „Praha 9: 360 Kč/m²").
- `ListingCard`: pod yield řádek přidat malý popisek `Odhad: 360 Kč/m² (Praha 9)` + tooltip „Zdroj: interní benchmark, aktualizováno YYYY-MM-DD".

## 4. Denní cache + automatický refresh benchmark dat

- Nový soubor `src/lib/scanner/rent-benchmark.server.ts`:
  - In-memory cache `{ data: Record<slug, number>, fetched_at: ISO }` per Worker instance.
  - Funkce `getBenchmark()`:
    - Pokud `fetched_at` < 24 h → vrátit cache.
    - Jinak `refreshBenchmark()` — naplánovaná „skutečná" implementace: zatím vrátí statickou tabulku z `valuation.ts` označenou jako `source: "static"`. Hooky připravené pro budoucí Firecrawl scrape pronájmů ze Sreality (TODO komentář).
  - Cachovat i v `globalThis.__rentBench` aby přežil HMR v dev.
- `calcYield()` přejmout `benchmark` parametr (nahradí statickou tabulku).
- `scan.functions.ts`: na začátku handleru `const bench = await getBenchmark()` a předat do `calcYield`.
- Vystavit `bench.fetched_at` v `ScanResult.meta.benchmark_fetched_at` → UI ukáže „Benchmark: 3. 6. 2026" v hlavičce/sidebaru.

## 5. Re-sort již načtených inzerátů bez nového skenu

Aktuálně sort běží server-side; změna `sort_by` v UI nedělá nic, dokud neklikneš „Skenovat".

- Přesunout sort logiku do client komponenty:
  - V `src/routes/index.tsx` rozšířit `useMemo(listings, …)` o závislost `filters.sort_by` a aplikovat stejný sort jako server (extrahovat do `src/lib/scanner/sort.ts`, sdílet client+server).
  - Server může nadále třídit pro počáteční pořadí, ale klient přebere kontrolu při změně.
- Stejně tak `groupedBySource` už reaguje na `sort_by === "source"`.
- Změna `sort_by` neresetuje `mutation.data` — žádný nový request.

---

## Soubory k úpravě / vytvoření
- `src/lib/scanner/types.ts` — `published_at_source`, `Investment.rent_source` + `rent_basis_label`, `ScanResult.meta`.
- `src/lib/scanner/valuation.ts` — district tabulka, `rentPerM2`, predání benchmarku.
- `src/lib/scanner/rent-benchmark.server.ts` *(nový)* — denní cache.
- `src/lib/scanner/sort.ts` *(nový)* — sdílená sort funkce.
- `src/lib/scanner/scan.functions.ts` — načtení benchmarku, diagnostika dat, použití sdíleného sortu.
- `src/lib/scanner/sources/*.ts` — povinné `published_at` + fallback + log.
- `src/components/ListingCard.tsx` — popisek zdroje nájmu, indikace fallback data.
- `src/components/DiagnosticsBar.tsx` — `dates_from` breakdown, čas benchmarku.
- `src/routes/index.tsx` — client-side sort přes `useMemo`.

## Mimo scope (na příště)
- Skutečný live scrape pronájmů Sreality pro benchmark (zatím připravený hook).
- Filtr „pouze konkrétní čtvrť" v sidebaru.
