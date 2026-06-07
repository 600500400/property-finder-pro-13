# Plán: regresní testy  + mobilní UX

## Část A — Regresní E2E

Pro kompletní regresní testy zjisti funkčnost všech zdrojů dát apod.

1. **Rozšířit `tests/e2e/scanner-detail-urls.test.ts**` o asserce na `ownership`:
  - Pro každý zdroj zavoláme fetcher (`fetchSreality`, `fetchBazos`, …).
  - U každého listingu zkontrolujeme, že `parseOwnership(name+locality+description_snippet)` vrátí `osobni | druzstevni | jine` (žádné `undefined` po fallbacku) — testujeme stejnou pipeline jako produkce (helper `resolveOwnership` extrahovaný z `scan-internal.server.ts`).
  - Pro vzorek prvních 2 inzerátů per zdroj stáhneme detailovou stránku (sreality přes `detailInfo`, ostatní fetchem URL) a porovnáme, že detekce z plného textu detailu se neliší od štítku zobrazeného v seznamu (nebo se mění jen `low → high`, nikdy `osobni ↔ druzstevni`).
2. **Nový soubor `src/lib/scanner/ownership.ts**` — vytáhne `resolveOwnership(listing, filters)` z duplikovaného kódu v `scan.functions.ts` a `scan-internal.server.ts`, aby test i produkce volaly totéž (DRY oprava nalezeného nesouladu).
3. **Statistický práh**: test selže, pokud >50 % inzerátů zdroje skončí jako `jine` s `confidence: "low"` — to indikuje rozbitý scraper.
4. Spustit `bunx vitest run tests/e2e/scanner-detail-urls.test.ts`, opravit zdroje, kde test spadne (zejména doplnit chybějící `description_snippet` u Annonce a Hyperinzerce, pokud je tam štítek často `JINÉ`).

## Část B — Mobilní UX: skrývatelné filtry + hustota výpisu

Cíl: na iPhonu (390 px) má uživatel napoprvé jasný panel filtrů, ale po prvním skenu se filtry sbalí, aby šlo rolovat výsledky. Zároveň přepínač zobrazení **Karty / Kompakt / Seznam**.

### B1. Sticky kolaps panel filtrů (mobile only)

- V `src/routes/index.tsx` přidat stav `filtersOpen` (default `true`; po prvním úspěšném `mutation.isSuccess` jednorázově `false`).
- `FilterSidebar` na mobilu (`md:hidden` varianta) přebalit do `<Sheet>` / `<Collapsible>`:
  - Když je zavřený, zobrazí se **sticky filter chip bar** pod hlavičkou: `[Prodej · Byty · Celá ČR · 4 zdroje]  [Upravit]  [Skenovat]`.
  - Klik na „Upravit" otevře plnostránkový `Sheet` s plnými filtry (reuse existující `FilterSidebar`).
  - Desktop (`md:`) zůstává beze změny — postranní panel 300 px.
- `MobileScanFooter` zachovat jen pro stav „filtry zavřené, zatím žádná data" (rychlé spuštění skenu).

### B2. Přepínač hustoty výpisu

- Nový stav `density: "card" | "compact" | "list"` (v `view`, persistován do `localStorage`).
- Přepínač v hlavičce výpisu (vedle počtu výsledků): tři ikony `LayoutGrid` / `Rows3` / `List`.
- V `ListingCard.tsx` přidat prop `density`:
  - **card** (default) — současný layout, 1 sloupec na mobilu.
  - **compact** — bez obrázku galerie/AI bloku, 2 sloupce na mobilu (`grid-cols-2`), zachovat OV/DV štítek + cena + výnos hvězdy.
  - **list** — řádkový layout (mini-thumb 56 px vlevo, vpravo název + cena + štítek vlastnictví + ★), 1 řádek per inzerát, ideální pro rychlý scan.
- Grid třídy v `index.tsx` se odvodí podle `density`:
  - card: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 …`
  - compact: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 …`
  - list: `flex flex-col divide-y`

### B3. Drobnosti

- Po prvním úspěšném skenu auto-scroll k prvnímu výsledku (`scrollIntoView`).
- Sticky chip bar má `backdrop-blur` + `bg-background/80`, aby zůstal čitelný nad výsledky.
- Po změně filtru (na mobilu, panel zavřený) chip bar bliká primárním okrajem 1 s — signál „spusť nový sken".

## Technické poznámky

- Žádné změny v scraper-business-logice mimo doplnění `description_snippet` tam, kde to test odhalí.
- Žádný nový npm balík — `Sheet`, `Collapsible`, `Tooltip` už jsou v shadcn/ui.
- Mobilní layout řešen čistě Tailwind breakpointy (`md:`), žádný JS detekce zařízení mimo existující `useIsMobile` (použít pro auto-collapse po skenu).

## Pořadí implementace

1. Extrakce `resolveOwnership` → DRY.
2. Rozšíření vitest souboru → spuštění → oprava nalezených zdrojů.
3. Density toggle (lokální, žádné zdrojové změny).
4. Mobilní kolaps filtrů + chip bar.
5. Vizuální QA na 390×844 (iPhone) přes browser preview.