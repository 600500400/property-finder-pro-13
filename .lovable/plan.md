# Opravy skenování a zobrazení

Tři nezávislé chyby, které opravím v jedné dávce.

## 1) Sreality – kliknutí vede na 404

**Příčina:** sestavujeme detail URL ručně podle `mainCb` a lokality, ale aktuální Sreality vyžaduje pro byty i segment dispozice (např. `/detail/prodej/byt/3+1/praha-vinohrady/<hash_id>`). Bez něj vrátí 404. Navíc API už často přímo vrací správný odkaz v `_links.self.href` (resp. `seo.locality`).

**Oprava** v `src/lib/scanner/sources/sreality.server.ts`:
- Pokud estate vrací `_links.self.href` nebo `seo.locality` + `hash_id`, použít je rovnou.
- Pro byty (`mainCb === 1`) přidat do cesty segment dispozice z `seo.category_sub_cb` → slug (`2+kk`, `3+1`, …).
- Jako poslední fallback místo neúplného detail URL použít odkaz na výsledky vyhledávání `https://www.sreality.cz/hledani/...?id=<hash_id>` (nikdy nesmí vést na 404).

## 2) Bazoš a Annonce – nic se neskenuje

**Bazoš:** parsujeme HTML podle třídy `inzeraty inzeratyflex`, která se na Bazoši mění a aktuálně neodpovídá – proto 0 výsledků (a v diagnostice OK, ale prázdné).
**Annonce:** Firecrawl extraktor sice běží, ale URL builder vrací stránku, která 25 inzerátů neobsahuje v hlavním obsahu (`onlyMainContent: true` je ořezává), nebo se LLM extrakce vrací prázdná.

**Oprava:**
- Přepnout **Bazoš na Firecrawl** stejně jako ostatní browser-zdroje (sjednocený `scrapeViaFirecrawl`). Tím odpadne křehký HTML parser. Bazoš jako jeden ze 7 zdrojů přes Firecrawl.
- **Annonce:** vypnout `onlyMainContent`, prodloužit `waitFor` na 3000 ms a upřesnit prompt, ať bere i položky mimo „main“ container; ověřit URL pattern (`https://reality.annonce.cz/<deal>-<cat>/`) – při prázdném výsledku zalogovat do diagnostiky.
- V `scan.functions.ts` přesunout `bazos` z `HTTP_FETCHERS` na firecrawl wrapper a smazat starý `bazos.server.ts`.

## 3) Chybějící obrázky u iDnes / RealityMix / Annonce / Hyperinzerce

**Příčina:** Firecrawl vrací relativní cesty (`/img/...`) nebo `data-src` lazy atributy, které ukládáme rovnou do `img`. Prohlížeč pak načítá relativně k naší doméně → 404 / nic.

**Oprava** v `firecrawl.server.ts`:
- Přidat `absolutizeImage(url, base)` – pokud začíná `//` přidat `https:`, pokud `/` připojit origin portálu, jinak nechat.
- V promptu explicitně požadovat **absolutní** URL a `src` (ne `data-src`, ne tracking pixely).
- Filtrovat zjevné placeholdery (`blank.gif`, base64 1×1, prázdný string).
- V `ListingCard.tsx` ponechat existující `onError → display:none` (už tam je).

## 4) Drobnost

V `DiagnosticsBar` zobrazit i případnou chybovou hlášku v tooltipu už dnes – stačí ověřit, že diagnostika z firecrawl scraperu propaguje chybu (`scrapeViaFirecrawl` při prázdném výsledku nehází – vrátí 0 a zobrazí žlutě „Žádné výsledky“, což je v pořádku).

## Soubory

- upravit `src/lib/scanner/sources/sreality.server.ts` (URL detailu)
- upravit `src/lib/scanner/sources/firecrawl.server.ts` (absolutní obrázky, Annonce tuning, přidat `fetchBazosFC`)
- upravit `src/lib/scanner/scan.functions.ts` (Bazoš → firecrawl)
- smazat `src/lib/scanner/sources/bazos.server.ts`
