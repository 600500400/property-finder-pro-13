## Plán oprav

### 1. Bezrealitky – GraphQL chyba (`dateCreated`)
Pole `dateCreated` na typu `Advert` neexistuje (API ho odebralo). Oprava v `src/lib/scanner/sources/bezrealitky.server.ts`:

- Odstranit `dateCreated` z `FIELDS`.
- Zkusit alternativy přes stejný fallback mechanismus jako u obrázků: postupně vyzkoušet `publishedAt`, `createdAt`, `lastUpdate`, žádné. Použít první variantu, která neselže s field-error.
- Datum mapovat do `published_at` podle toho, co vrátí ne-null.

### 2. Hyperinzerce – EMPTY (0 inzerátů, 11 s)
Firecrawl scrape vrací prázdno – pravděpodobně špatná URL nebo žádné inzeráty na výchozí stránce. Oprava v `firecrawl.server.ts`:

- Přepsat `buildHyperinzerceUrl` na funkční formát: `https://reality.hyperinzerce.cz/prodej-bytu/` (varianty `prodej-bytu/`, `prodej-domu/`, `prodej-pozemku/`, `prodej-komercnich-objektu/`, `prodej-garazi/`). Ověřit přes `fetch_website`.
- Pokud i s opravenou URL Firecrawl vrátí 0, přidat HTML fallback (přímý fetch + regex parsing) podobně jako u Bazoše.

### 3. Annonce – obrázky + chybné detail URL
URL inzerátu vede na kategorii místo detailu (Firecrawl zachytil odkaz z bočního panelu, ne kartu inzerátu). Oprava:

- Zpřísnit prompt: „URL musí obsahovat `/detail/` nebo numerické ID inzerátu, ne `-f-` (filtr) ani `na-prodej`".
- Post-filter v `scrapeViaFirecrawl` (volitelně per-source): zahodit URL matchující regex `\/[^/]+-f-\d+\.html$`.
- U obrázků: rozšířit prompt o explicitní wording, že obrázek je `<img>` uvnitř karty (`.item`, `.inzerat`), ne logo portálu. Zvýšit `waitFor` na 5000 a zapnout `onlyMainContent: false` (už je).
- Pokud problém přetrvá → fallback Bazoš-style HTML scrape pro Annonce.

### 4. Sreality – obrázky se nezobrazují
Náš filtr v `extractImage` je správný, ale produkční sandbox (Cloudflare worker) nemusí dostávat plný embed obrázků z `/api/cs/v2/estates`. Oprava v `sreality.server.ts`:

- Logovat (pro diagnostiku) počet inzerátů s/bez obrázku.
- Rozšířit hledání i o `_links.images` jako objekt s vnořeným polem `image` (Sreality občas vrací `_links: { images: [{ href }] }` na top level, jindy `_embedded.images`).
- Přidat fallback: pokud žádný kandidát nesplní `isPropertyPhoto`, vzít první URL z `_links.images` bez filtru loga (logy mají `d_logo_`, foto má `c_img_`, ale CDN někdy vrátí jiný path) – ale jen pokud doména je `*.sdn.cz` a path NEobsahuje `logo|branding`.
- Smazat `wrm,/watermark` z URL (volitelné, watermark je problém zobrazení) — necháme tak, jen ošetřit, že URL projde.
- Pokud API nevrací obrázky vůbec, fallback: zkonstruovat URL z `hash_id` přes známý template `https://d18-a.sdn.cz/d_18/c_img_QO/abc.jpeg` – **toto nelze bez ID** → vynechat, místo toho zlogovat warning.

### 5. Datum zveřejnění – zobrazit u inzerátu
Datum už máme (`published_at`), ale na kartě se ukazuje jen relativní text malým fontem. Oprava v `ListingCard.tsx`:

- Vedle ceny zobrazit absolutní datum (např. `3. 6. 2026`) místo (nebo vedle) relativního.
- Pokud `published_at` chybí, žádný text nezobrazovat.

### 6. Přejmenovat „TOP" → „HOT" pro inzeráty ≤24h
Aktuálně:
- `freshnessBadge()` už generuje **HOT 🔥** pro ≤24h. ✅
- Ale Bazoš/Sreality dávají vlastní badge **TOP** (placená pozice). To uživatele mate.

Oprava:
- V `bazos.server.ts` a `sreality.server.ts` přejmenovat `"TOP"` na `"Placené"` (nebo `"Promo"`) – stále viditelné, ale nepřekrývá HOT.
- `ListingCard` přidat styl pro `"Placené"` (neutrální šedý badge).
- HOT 🔥 zůstává pouze pro inzeráty zveřejněné ≤24h.

### 7. Reálná tržní data nájmů
Současné hodnoty v `valuation.ts` jsou statická tabulka (Praha 380 Kč/m² = ~9 200 Kč za 24m²) – pro Prahu 9 / větší byty nereálné. Reálný trh Praha 2024/25 je ~330–420 Kč/m² podle čtvrti, ale s podstatným rozptylem. Plán:

- **Krátkodobě:** upravit tabulku podle aktuálního Deloitte Rent Index Q4 2024 + ČSÚ:
  - Praha průměr 415 Kč/m² (P1 480, P9 360, P10 340 atd.)
  - Brno 320, Plzeň 280, Ostrava 230, krajská města 220–260, ostatní 180–210
  - Pro byty rozlišit dispozici: 1+kk/1+1 vyšší per-m² (~+15 %), 4+kk/5+1 nižší (~−10 %).
- **Dlouhodobě (volitelně):** vytáhnout reálná data přes Firecrawl scrape ze sreality.cz „pronájem byty" pro daný kraj × dispozici → zprůměrovat → cachovat 24h. To je samostatná feature, doporučuji v dalším kole.
- V UI přidat malou poznámku „Odhad podle průměru kraje – orientační".

### 8. Typ vlastnictví (osobní / družstevní / státní)
Tuto informaci portály vystavují různě:
- **Sreality:** v `items[].name` nebo `seo.category_sub_cb`; lepší v `_embedded.estate.values` (`ownership_cb`: 1=osobní, 2=družstevní, 3=státní). Vytáhnout z detailu seznamu, kde je dostupné. 
- **Bezrealitky:** GraphQL pole `ownership` nebo `tenure` – ověřit přes introspection (stejný fallback mechanismus).
- **Bazoš:** parsovat z titulku regex (`družstevní|osobní|OV|DV`).
- **Firecrawl zdroje:** přidat do schema pole `ownership_type`.

Plán:
- Přidat `ownership?: "osobni" | "druzstevni" | "statni" | "jine"` do `Listing`.
- Vytáhnout všude, kde to jde (Sreality + Bazoš guaranteed, ostatní best-effort).
- Zobrazit jako malý badge pod cenou (např. „OV" / „DV"), případně přidat filtr do `FilterSidebar`.

---

## Soubory k úpravě
- `src/lib/scanner/sources/bezrealitky.server.ts` – odstranit `dateCreated`, fallback na alternativní pole; přidat ownership.
- `src/lib/scanner/sources/sreality.server.ts` – rozšířit `extractImage`, diagnostika, ownership, přejmenovat badge TOP.
- `src/lib/scanner/sources/bazos.server.ts` – přejmenovat badge TOP→Placené, parse ownership z titulku.
- `src/lib/scanner/sources/firecrawl.server.ts` – opravit hyperinzerce URL, zpřísnit Annonce prompt + post-filter detail URL, schema přidat `ownership_type`.
- `src/lib/scanner/valuation.ts` – aktualizovaná tabulka nájmů (Praha + okresy přesněji), poznámka.
- `src/lib/scanner/types.ts` – `ownership` na `Listing`.
- `src/components/ListingCard.tsx` – absolutní datum, ownership badge, styl pro „Placené".

## Co plán neřeší (na příště)
- Plnohodnotný live rent benchmark scrapingem Sreality pronájmů (s cachí) – samostatná etapa.
- Filtr „pouze osobní vlastnictví" v sidebaru (přidám až po ověření, že data jsou spolehlivá).
