## 1. Oprava obrázků ze Sreality

**Problém:** `extractImage()` vrací první URL nalezenou rekurzivně – často trefí logo makléře (`_embedded.seller.logo`, `branding`, `company_logo`) místo fotky nemovitosti.

**Řešení v `src/lib/scanner/sources/sreality.server.ts`:**

- Hledat **pouze** v `_embedded.images[]` (hlavní galerie), případně `_links.images[]` – nikdy ne rekurzivně přes celý objekt.
- Pokud nalezeno: vzít první `href` a normalizovat (template `{width}/{height}` → `800/600`, ponechat query `?fl=res,...` – to Sreality CDN vyžaduje, jinak vrací 403).
- Vynechat URL obsahující `/logo/`, `/branding/`, `seller`, `company`.
- Pokud galerie chybí → vrátit `""` (fallback ikona domu) místo loga.
- Také ošetřit, že některé estaty mají `_links.images` jako objekt s `image_middle/image_big` (string href) – přijmout jen pokud doména je `sdn.cz` a path obsahuje `/c_img_` (foto), ne `/d_logo_` / `branding`.

Test URL z příkladu (`d18-a.sdn.cz/d_18/c_img_p9_A/...jpeg?fl=res,2200,2200,1|wrm,...`) – tato URL je validní, musí projít. Loga mají typicky `d_logo_` nebo `branding` v cestě.

## 2. Investorské doporučení pro všechny typy nemovitostí

Aktuálně `calcYield()` v `valuation.ts` počítá **jen pro `property_type === "ostatni"**` (garáže). Rozšířit na byty, domy, komerční.

**Návrh:**

- Tabulka odhadovaného nájmu **per m² / měsíc** podle regionu × typu (byt/dům/komerční). Hodnoty zhruba podle českého trhu 2024–25, např. Praha byt 380 Kč/m², Brno 280, krajská města 220, ostatní 180; domy ~80 % bytového; komerční ~250 Kč/m² Praha atd.
- Extrahovat plochu z názvu/area pole (regex `(\d+)\s*m²` už máme) – uložit jako number `area_m2` v `Listing`.
- `calcYield(price, region, propertyType, area_m2)`:
  - byty/domy/komerční: `monthly = rent_per_m2 * area_m2`
  - garáž/stání (ostatni): současná logika (fixní nájem regionu)
  - bez plochy → fallback fixní odhad podle typu+region (nebo `null` s poznámkou)
- Hodnocení (★1–5, verdict) ponechat dle čistého výnosu, jen jemně doladit thresholdy pro byty (4 % net = průměr trhu, 5 % dobré, 6 % výborné).
- V `ListingCard` zobrazit investiční metriky pro všechny typy – sekce už existuje, jen ji odemknout.  
  
zde jsou důležité ty hodnoty - budeš moci mít zdroj dat nebudeš vycházet z tabulky která se týkala garáži je to tak?

## 3. Datum zveřejnění + HOT/NOVÝ badge

**Logika scrapingu dnes:** Všechny zdroje vrací **aktuálně inzerované** nabídky tříděné defaultně podle relevance/data zdroje (Sreality `sort=0` = nejnovější; Bazoš výpis je chronologický). Není to historický archiv – jakmile inzerát zmizí z výpisu portálu, scanner ho už nevidí. Skenuje se vždy na vyžádání (kliknutím), žádné ukládání mezi běhy.

**Co přidáme:**

- Nové pole `published_at?: string` v `Listing` (ISO date).
- **Sreality:** dostupné v `last_update`, `_embedded.estate.last_update` nebo `date` – extrahovat.
- **Bazoš:** v HTML bloku `inzeratydatum` (formát `[3.6. 2026]`) – parsovat regex.
- **Bezrealitky:** GraphQL pole `dateCreated` / `publishedAt`.
- **Firecrawl zdroje:** doplnit do extraction promptu.
- **Sort by date:** přidat volbu „Nejnovější" do `sort_by`.
- **Badge logika v `ListingCard`:**
  - ≤ 24 h → červený **HOT 🔥**
  - ≤ 72 h → modrý **NOVÝ**
  - ≤ 7 dní → šedý **Tento týden**
  - jinak relativní text („před 12 dny") pod cenou.

## 4. Drobnosti

- Sort: přidat `date_desc` (nejnovější první) jako default po skenu.
- Diagnostika: zobrazit u Sreality, kolik inzerátů má/nemá obrázek (rychlá kontrola opravy).

## Soubory k úpravě

- `src/lib/scanner/sources/sreality.server.ts` – přepsat `extractImage`, doplnit `published_at`.
- `src/lib/scanner/sources/bazos.server.ts` – parsovat datum, badge HOT.
- `src/lib/scanner/sources/bezrealitky.server.ts` – datum z GraphQL.
- `src/lib/scanner/sources/firecrawl.server.ts` – prompt: pole `published_date`.
- `src/lib/scanner/valuation.ts` – nová tabulka nájmů per m², rozšířená logika.
- `src/lib/scanner/types.ts` – `published_at`, `area_m2`, nové sort.
- `src/lib/scanner/scan.functions.ts` – předat plochu do `calcYield`, podpora sortu.
- `src/components/ListingCard.tsx` – HOT/NOVÝ badge dle data, investiční sekce pro všechny typy.
- `src/components/FilterSidebar.tsx` – přidat sort „Nejnovější".

## Co plán neřeší

- Historické inzeráty (vyžadovalo by vlastní databázi + cron sběr – velký scope, můžeme řešit samostatně, případně přes Lovable Cloud).