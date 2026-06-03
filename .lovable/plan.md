## Co jsem otestoval

Spustil jsem výchozí sken (Prodej / Ostatní / Garáž / Středočeský; zdroje Sreality + Bazoš + Bezrealitky). Výsledek z diagnostiky:

- **Sreality** — 52 inz., 256 ms — OK
- **Bazoš** — 20 inz., **35 594 ms** — funguje, ale extrémně pomalé a část inzerátů nemá obrázek
- **Bezrealitky** — **0 inz., 354 ms** — odpověď OK, ale prázdný seznam

## Nalezené chyby

### 1. Bezrealitky vrací 0 výsledků (kritické)

Ruční dotaz na `api.bezrealitky.cz/graphql/` vrátil:

```
"Variable $estateType got invalid value [\"OSTATNI\"]; Expected type EstateType at value[0]"
```

Introspekce `EstateType` ukázala aktuální platné hodnoty: `UNDEFINED, BYT, DUM, POZEMEK, GARAZ, KANCELAR, NEBYTOVY_PROSTOR, REKREACNI_OBJEKT`.
V `bezrealitky.server.ts` zatím mapujeme `ostatni → OSTATNI` a `komercni → KOMERCNI` — obě hodnoty v aktuálním schématu neexistují, takže GraphQL vrací errory a fetcher končí s prázdným seznamem.

### 2. FilterSidebar zobrazuje u Bazoše badge „HTML" místo „BROWSER"

Bazoš jsme přesunuli na Firecrawl, ale v `src/components/FilterSidebar.tsx` zůstal v `SOURCES` typ `html` a badge `HTML`. UI tím uživatele mate (vypadá to jako rychlý HTTP zdroj, ale ve skutečnosti spotřebovává Firecrawl kredity a trvá ~30 s).

### 3. Bazoš přes Firecrawl trvá ~35 s

Aktuálně používáme společný `scrapeViaFirecrawl` s `waitFor: 2000` a LLM JSON extrakcí. Pro Bazoš je to overkill — Bazoš je čisté HTML bez JS, nepotřebuje headless browser. Před přechodem stačil HTTP fetch + cheerio (~1 s) — jen měl rozbitý selektor.

### 4. Některé Bazoš karty nemají obrázek

Firecrawl LLM extrakce občas vrátí prázdný `image` (lazy `data-src` v `<img>`). Náš `absolutize()` to už filtruje, ale neexistuje fallback na vyhledání `data-src` v HTML.

### 5. Drobnost — `bb-customSelect` hydration warning

V konzoli je hydration mismatch způsobený browser extenzí v select prvcích (`bb-custom-select-container`). Není to bug aplikace, ale stojí za zmínku — neopravuji.

## Plán oprav

### A) Oprava `src/lib/scanner/sources/bezrealitky.server.ts`

- Přemapovat `ESTATE` na platné enum hodnoty:
  - `byty → BYT`, `domy → DUM`, `pozemky → POZEMEK`
  - `ostatni → GARAZ` (drží se původní logiky scanneru garáží)
  - `komercni → KANCELAR` (případně rozšířit na `[KANCELAR, NEBYTOVY_PROSTOR]`)
- Ověřit, že `OfferType` (`PRODEJ`/`PRONAJEM`) zůstává platné (test ukázal že ano).

### B) Návrat Bazoše na HTML scrape (rychlost)

- Znovu vytvořit `src/lib/scanner/sources/bazos.server.ts` s HTML fetch + regex/cheerio-light parserem, ale **na aktuálních selektorech** (článek `<div class="inzeraty">` / `<div class="inzeratynadpis">`). Cíl < 3 s.
- V `scan.functions.ts` přepnout `bazos` zpět na nový `fetchBazos` z `bazos.server.ts`.
- V `firecrawl.server.ts` odstranit `fetchBazos` a `buildBazosUrl`.

### C) Sjednotit FilterSidebar

- V `SOURCES` opravit položku Bazoš: `type: "html"`, `badge: "HTML"` (zůstává po návratu k HTTP scrape — což odpovídá realitě).
- Žádné jiné položky neměnit.

### D) Lepší extrakce obrázků pro Firecrawl zdroje

- Rozšířit prompt v `firecrawl.server.ts`, aby explicitně hledal i `data-src`, `data-original` a `srcset` (a vybral první URL ze `srcset`).
- Volitelně: druhý průchod přes `links`/`html` formát Firecrawlu jako fallback (pokud `image` chybí, dohledat první `<img>` v daném listing bloku). Toto až pokud (A)–(C) nestačí.

## Co se NEMĚNÍ

- Sreality (funguje, 256 ms, 52 výsledků).
- iDnes / RealityMix / Annonce / Hyperinzerce přes Firecrawl (uživatel je v defaultu nemá zapnuté; otestujeme až po opravě výše).
- Vzhled karet a layout.

## Soubory, kterých se to dotkne

- `src/lib/scanner/sources/bezrealitky.server.ts` (oprava enum mapování)
- `src/lib/scanner/sources/bazos.server.ts` (znovu vytvořit)
- `src/lib/scanner/sources/firecrawl.server.ts` (odstranit Bazoš + vylepšit prompt pro obrázky)
- `src/lib/scanner/scan.functions.ts` (přepojit Bazoš)
- `src/components/FilterSidebar.tsx` (badge Bazoš zpět na HTML)

Ok ještě se zamer na UI aplikace předdefinované hodnoty jsou tam typ garáže. To změn. Ať jsou tam předdefinované byty na prodej.a predvybrane všechny realitní servery. Zrus to a nech na uživateli které realitní servery chce skenovat. Nastav tam limit např. Ne všechny jenom třeba 20nejaktualnejsich nebo podobne. Taky bychom potřebovali někam schovat logo ani. V případě chyby abychom se mohli podívat do logu. Navrhni další vylepšení UI