
## Cíl

1. Odstranit samostatný filtr „Typ vlastnictví" — funguje špatně a uživatel ho nechce.
2. Místo toho zobrazit **vlastnictví jako badge přímo na kartě inzerátu** vedle ostatních flagů (HOT, NOVÝ, datum).
3. Zjednodušit doménu na **3 hodnoty**: `osobni` (OV), `druzstevni` (DV), `jine` (vše ostatní + neurčeno).
4. Detekovat z popisu inzerátu **skrytou anuitu / nesplacený úvěr** u družstevních bytů a flagovat ji.

---

## Část A — Vlastnictví jako badge na kartě

### Sjednocení typů (`src/lib/scanner/types.ts`)
`Ownership` zúžit na: `"osobni" | "druzstevni" | "jine"`. `statni` přemapovat na `jine`.

### Per-zdroj extrakce (každý má jiný dataset — proto vrstvený pipeline)

| Zdroj | Primární zdroj dat | Fallback |
|---|---|---|
| **Sreality** | `ownership_cb.value` (1=OV, 2=DV, 3→`jine`) — už máme, spolehlivé | regex z názvu |
| **Bezrealitky** | GraphQL `tenure` enum (`VLASTNI`/`DRUZSTEVNI`/`OSTATNI`) — máme | — |
| **Bazoš / Hyperinzerce / Annonce** | regex přes `title + popis` z výpisu | `jine` |
| **iDnes / RealityMix (Firecrawl)** | rozšířit JSON schema o pole `ownership_text` (volný text z karty „Vlastnictví") a parsovat | regex z názvu |

### Centrální parser (`valuation.ts` → `parseOwnership`)
Rozšířit pravidla:
- DV: `družstevní`, `dv`, `družstvo`, `převod členských práv`, `člen­ský podíl`
- OV: `osobní vlastnictví`, `ov`, `do osobního vlastnictví`, `v osobním vlastnictví`
- vše ostatní (vč. `státní`/`obecní`/nedetekováno) → `jine`

Funkce má vracet i confidence (`"high" | "low"`) podle toho, jestli match přišel z API/explicitního pole nebo jen z volného textu. Použito pro vizuální odlišení badge.

### UI — `ListingCard.tsx`
- Přidat ownership badge mezi badges v hlavičce karty (vedle HOT/NOVÝ), ne dolů k lokalitě jako teď.
- Barevné rozlišení:
  - OV → neutrální/zelený outline (bezpečné)
  - DV → žluto-oranžový (pozor, jiný režim financování)
  - jine → šedý
- Při `confidence=low` mírně ztlumit + tooltip „odhad z názvu".

### UI — `FilterSidebar.tsx`
- **Smazat celou sekci „Typ vlastnictví"** (řádky ~227–253) a souvisí­cí `OWNERSHIP_OPTS`.
- V `types.ts` odstranit `ownership?: Ownership[]` ze `ScanFilters`.
- V `routes/index.tsx` odstranit ownership filtraci ve `useMemo` (~ř. 87–95).

---

## Část B — Detekce skryté anuity u družstevních bytů

### Problém
U DV bytů bývá uvedená cena jen za „bytovou jednotku / členský podíl" (např. 2 mil.), ale ve skutečnosti je k tomu **nesplacená anuita** (např. 8 mil.), kterou kupec přebírá. To zásadně mění výnos a návratnost.

### Návrh — heuristika nad popisem inzerátu

Nový modul `src/lib/scanner/anuity.ts` (čistý, žádné side-effecty):

```ts
export interface AnuityInfo {
  has_anuity: boolean;          // detekováno zmínkou
  amount?: number;              // pokud se podařilo vyparsovat částku
  effective_price?: number;     // price + amount (pokud známe obojí)
  confidence: "high" | "medium" | "low";
  source_phrase?: string;       // krátký výňatek pro tooltip / AI dialog
}

export function detectAnuity(text: string, basePrice: number, ownership?: Ownership): AnuityInfo
```

Heuristika (case-insensitive, NFD):
1. **Spouštěč**: `ownership === "druzstevni"` *nebo* text obsahuje „anuita", „nesplacený úvěr", „úvěr družstva", „zbývá doplatit", „doplatek anuity", „převzetí úvěru".
2. **Extrakce částky** — regex blíže ke spouštěči (okno ±80 znaků):
   - `(\d[\d\s.,]{2,})\s*(?:kč|czk|mil(?:\.|ionů)?|tis(?:\.|íc)?)`
   - normalizace „2,5 mil" → 2 500 000.
3. **Confidence**:
   - `high` — našli jsme spouštěč i částku
   - `medium` — spouštěč + DV bez částky
   - `low` — jen DV bez zmínky (default `false` → nezobrazujeme)
4. **effective_price** = `basePrice + amount`, pokud obojí > 0.

### Kde získáme „popis"?

Většina zdrojů má v listingu jen titulek + krátký snippet. Tři úrovně:

1. **Co máme zdarma teď** (žádné nové requesty): u `Bazoš`/`Hyperinzerce` existuje `popis`/`description` blok ve výpisu — už ho čteme pro `parseOwnership`. Stačí ho propsat do nového pole `Listing.description_snippet` a poslat do `detectAnuity`.
2. **Sreality**: API vrací `advert_name` (krátké). Pro lepší detekci by chtělo `meta_description` nebo detail call — viz volitelná fáze 2 níže.
3. **AI fallback** (volitelné, low-cost): pokud `ownership === "druzstevni"` a heuristika nic nenašla, můžeme v existujícím `analyzeListing` (Lovable AI) doplnit otázku „Je v inzerátu zmínka o anuitě? Pokud ano, kolik?" — ale jen on-demand při kliknutí na AI analýzu, ne plošně.

### Datový model
V `Listing` přidat volitelné:
```ts
description_snippet?: string;  // surový text z výpisu (pro heuristiku)
anuity?: AnuityInfo;           // výsledek detekce
```

Pole `anuity` se počítá v `executeScan` ve stejném map kroku jako `ownership`/`invest`. Pokud `anuity.effective_price` existuje, **přepočítat `calcYield` s ní** místo původní ceny → výnos i návratnost budou realistické.

### UI
Na kartě (`ListingCard.tsx`), když `listing.anuity?.has_anuity`:
- Červený/jantarový badge **„+ ANUITA"** vedle ownership.
- Pod cenou malý řádek: `~ 2,0 mil. + 8,0 mil. anuita = 10,0 mil. efektivní` (pokud známe částku).
- Tooltip s `source_phrase`.
- V `invest` boxu poznámka „výnos přepočten s anuitou".

---

## Část C — Kvalitativní self-check zdrojů

Lehký add-on do diagnostiky (`DiagnosticsBar`):
- Per zdroj spočítat: `% s ownership`, `% s area_m2`, `% s published_at != fallback`, `% s description_snippet`.
- Žádné nové requesty, jen agregace nad výsledky.
- Pomůže rychle vidět, který portál degraduje a kde mu chybí data.

---

## Sled prací (build mode)

1. `types.ts` — zúžit `Ownership`, přidat `description_snippet`, `anuity` do `Listing`, odstranit `ownership` ze `ScanFilters`.
2. `valuation.ts` — rozšířit `parseOwnership` (vrací i confidence) a přemapovat `statni`→`jine`.
3. `anuity.ts` — nový modul s `detectAnuity`.
4. Source adaptéry — propsat `description_snippet` (Bazoš, Hyperinzerce, Annonce už mají popis; Bezrealitky/Sreality použijí to, co je v API).
5. `scan-internal.server.ts` — volat `detectAnuity` a v případě efektivní ceny přepočítat `calcYield`.
6. `ListingCard.tsx` — ownership badge nahoře, anuita badge + řádek pod cenou.
7. `FilterSidebar.tsx` — smazat sekci „Typ vlastnictví".
8. `routes/index.tsx` — smazat ownership filtraci v `useMemo`.
9. `DiagnosticsBar` — sloupce data-quality (volitelné, pokud zbude prostor).

## Mimo scope

- Nový request na detailní stránku inzerátu kvůli plnému popisu (možná fáze 2, znamená N×N HTTP).
- Změna AI dialogu (`AIAnalysisDialog`) — anuita se tam přirozeně objeví v promptu, ale samotný UI nestrhávám.
- Změny ve scheduled scans a saved filters (smazání `ownership` filtru ze `ScanFilters` znamená, že staré uložené filtry s `ownership` polem to prostě budou ignorovat — backward-compatible).
