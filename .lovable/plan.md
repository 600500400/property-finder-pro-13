## Plán úprav

### 1) Oprava Sreality obrázků
V `sreality.server.ts` v `extractImage()` aktuálně bereme z `_links.images/image_middle/...`. Z aktuálního API ale často přijde objekt s `_links.images` jako pole objektů s `href` template stringem (`...{width}x{height}...`) nebo přímo v `_embedded.images[].href`. Ošetříme:
- procházet `e._embedded?.images` a `e.images` pole objektů,
- akceptovat i `href` v hlubších strukturách,
- pro template URL nahradit `{width}/{height}` (už děláme) i `{fileName}` placeholdery,
- fallback walk i přes pole čísel/objektů (už máme, rozšířit i na URL bez `sdn.cz` doménový whitelist – stačí test na příponu obrázku).

### 2) Volba počtu inzerátů na zdroj (limit)
- Přidat do `ScanFilters` pole `per_source_limit: number` (default 20).
- V sidebaru přidat `Select` s hodnotami `10 / 20 / 50 / 100`.
- V `scan.functions.ts` použít místo hardcoded `slice(0, 20)` hodnotu z filtru, clamp 1–100. Stejný limit propsat do fetcherů, kde to dává smysl (Sreality `per_page`, Bezrealitky `limit`, Bazoš break loop).

### 3) Sjednocení podkategorie napříč zdroji (garáž vs. garážové stání)
Realita: každý portál má jiné taxonomie a chybové míchání. Pragmatický fix:
- Když uživatel vybere `sub_type = garaz` nebo `garazove_stani`, ve fetcherech, které kategorii neumí spolehlivě filtrovat (Bazoš/Bezrealitky/Firecrawl zdroje), na klientu po fetchi **post-filtrujeme** podle klíčových slov v `name` (garáž/stání).
- U Sreality už `category_sub_cb` posíláme – ponecháme.
- Doplníme tooltip u podkategorie: „Některé portály nerozlišují – výsledky filtrujeme dodatečně podle názvu."

(Specializaci jen na byty zatím neděláme – ponecháme všechny typy, jen vylepšíme přesnost.)

### 4) FilterSidebar – nové UX prvky
- **Toolbar nad seznamem zdrojů**: `Vybrat vše` / `Žádný` / `Jen rychlé (API+HTML)` – tři malá tlačítka.
- **Limit počtu** (viz #2) jako nová sekce.
- **Filtr „Jen s obrázkem"** – checkbox; aplikuje se v `Index` po fetchu.
- **Dedup toggle** „Skrýt duplicity (lokalita + cena)" – checkbox; v `Index` přes Map klíč `${locality}|${price}` ponechat první.
- **Presety filtrů** (localStorage):
  - tlačítko „Uložit jako preset" → prompt na název → zápis do `localStorage.realityscanner.presets`,
  - dropdown s uloženými presety + ikonka smazat,
  - klíč `realityscanner.lastFilters` automaticky ukládá poslední konfiguraci a načítá při startu.

### 5) Sticky filter footer na mobilu
- V `FilterSidebar` přesunout `Skenovat` + `Export CSV` na desktopu ponechat dole v sidebaru, ale na mobilu (`md:hidden`) renderovat zvlášť jako `fixed bottom-0 inset-x-0` panel s pozadím a stínem.
- Hlavní `main` dostane `pb-24 md:pb-0`.

### 6) Skeleton karty během skenu
- Nový komponent `ListingCardSkeleton` (využije `ui/skeleton.tsx`).
- V `Index` během `mutation.isPending` renderovat grid 8–12 skeletonů místo prostého centra se spinnerem (spinner ponechat malý v hlavičce/diagnostice).

### 7) TOP / Nový badge
- Rozšířit `Listing` typ o volitelné `badges?: string[]`.
- Ve `sreality.server.ts` zachytit `label_top`/`is_topped`/`mark_as_new` z odpovědi (pokud existují) → `["TOP"]` / `["NOVÝ"]`.
- V Bazoš parseru detekovat `TOP` v HTML bloku (třída/word).
- `ListingCard` zobrazí chip-y vpravo nahoře u obrázku (vedle ikony ExternalLink).

### 8) Drobnosti
- Defaulty zachovat: `byty / prodej / Celá ČR / sources=[]`.
- Diagnostika: `DiagnosticsBar` už je sbalený, jen ověřit, že tlačítko „Log" je viditelné i bez výsledků (skryjeme jen pokud `items` prázdné).

## Soubory k úpravě
- `src/lib/scanner/types.ts` – `per_source_limit`, `only_with_image`, `dedupe`, `badges?`.
- `src/lib/scanner/scan.functions.ts` – respektovat `per_source_limit`, předat fetcherům, post-filtr podkategorie.
- `src/lib/scanner/sources/sreality.server.ts` – lepší extrakce obrázků, TOP/NEW badge, `per_page` z limitu.
- `src/lib/scanner/sources/bazos.server.ts` – limit + TOP detekce.
- `src/lib/scanner/sources/bezrealitky.server.ts` – `limit` parametr.
- `src/components/FilterSidebar.tsx` – toolbar zdrojů, limit select, presety, „jen s obrázkem", dedup toggle, mobile sticky footer.
- `src/components/ListingCard.tsx` – badges (TOP/NOVÝ).
- `src/components/ListingCardSkeleton.tsx` – nový.
- `src/routes/index.tsx` – skeleton grid, dedup + image filter, načtení/uložení presetů, mobile bottom padding.

## Co se NEMĚNÍ
- Backend zdrojů (kromě bodu #1 a limitu) – funguje.
- Vzhled karet zůstává, jen přibudou badge chip-y.
- Žádné zúžení app na „jen byty" – necháme univerzální.
