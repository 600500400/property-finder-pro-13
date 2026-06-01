## Cíl

Přenést tvou lokální Flask aplikaci `Reality Scanner v5` na web. Aplikace bude:
- skenovat realitní portály podle filtrů,
- počítat hrubý/čistý výnos, návratnost a hodnocení investice,
- zobrazovat výsledky v kartové mřížce jako teď,
- nabízet export CSV,
- běžet bez databáze (živé výsledky, jako Python verze).

## Klíčová technická rozhodnutí

**Stack:** TanStack Start (React 19 + TypeScript) na Cloudflare Workers — standardní Lovable šablona. Python/Flask na Lovable nejde.

**Scraping bez Pythonu:** Cloudflare Workers nepodporují Playwright ani `curl_cffi`. Místo toho použiji **Firecrawl** (konektor) jako univerzální scraping engine — má vlastní headless Chromium v cloudu, obchází Cloudflare challenge a JS rendering. Pokryje i původně „BROWSER" zdroje (iDnes, RealityMix, Annonce, Hyperinzerce), jakmile je ve fázi 2 dodáme.

**Strategie zdrojů (fáze 1):**

| Zdroj | Metoda | Stav |
|---|---|---|
| Sreality | JSON API přes `fetch` | aktivní |
| Bazoš | HTML přes `fetch` + parsing | aktivní |
| Bezrealitky | GraphQL přes `fetch` | aktivní |
| iDnes / RealityMix / Annonce / Hyperinzerce | Firecrawl | UI viditelné, scraping doděláme po napojení Firecrawl ve fázi 2 |

Pokud Sreality bude blokovat (bez TLS fingerprintu jako `curl_cffi`), přepneme i ji na Firecrawl.

**Bez databáze:** každý sken vrátí čerstvá data, nic se neukládá.

## UI / vzhled

Modernější tmavý realitní portál, zachovám tvoje rozložení:

- **Levý sticky sidebar** (filtry): Kraj, Vlastnictví, Cena od–do, checkboxy zdrojů s badgi (API / HTML / GraphQL / BROWSER), řazení, tlačítka „Skenovat" a „Export CSV".
- **Hlavní oblast:** počet nalezených inzerátů, sekce po zdrojích s časem skenu, responzivní grid karet (5 sloupců desktop → 1 mobil).
- **Karta inzerátu:** thumbnail, badge zdroje, název, lokalita, cena (akcent), 2×2 mřížka metrik (hrubý výnos %, čistý výnos %, nájemné/měs, návratnost roky) s barevným kódem podle výnosnosti, řádek s hodnocením (Výborná investice 🏆 / Dobrá ✅ / Průměrná 🪙 / Podprůměrná ⚠️ / Nevýhodné ❌), klik otevře původní inzerát v novém tabu.
- **Vzhled:** tmavé pozadí (ne čistá čerň), jemné bordery, moderní sans-serif (Inter) pro UI, monospace (JetBrains Mono) pro čísla — odkaz na původní terminálový feel bez „hackerského" přehánění. Zelená pro pozitivní výnosy, oranžová/červená pro slabé.
- Header s logem „RealityScanner", živé hodiny, badge s počtem výsledků.

## Logika výpočtů

Přepíšu 1:1 z `app.py` do TypeScriptu (server function): odhad nájemného podle typu/lokality, hrubý výnos, čistý výnos po provozních nákladech, návratnost v letech, klasifikace do 5 kategorií. Konkrétní koeficienty převezmu přesně z `app.py` při buildu.

## Architektura

```text
src/
├─ routes/
│  ├─ __root.tsx                  ← shell + dark theme
│  └─ index.tsx                   ← UI (filtry + výsledky)
├─ lib/scanner/
│  ├─ scan.functions.ts           ← createServerFn — orchestrace skenu
│  ├─ sources/
│  │  ├─ sreality.server.ts       ← JSON API
│  │  ├─ bazos.server.ts          ← HTML parsing
│  │  ├─ bezrealitky.server.ts    ← GraphQL
│  │  └─ firecrawl.server.ts      ← fallback pro browser zdroje (fáze 2)
│  ├─ valuation.ts                ← výpočty výnosů + klasifikace
│  └─ types.ts
├─ components/
│  ├─ FilterSidebar.tsx
│  ├─ ResultsGrid.tsx
│  ├─ ListingCard.tsx
│  └─ SourceGroupHeader.tsx
└─ styles.css                     ← design tokens (oklch)
```

Server function `runScan({ filters, sources })`:
- paralelně spustí scrapery jen pro vybrané zdroje (`Promise.allSettled`, timeout per zdroj),
- znormalizuje výsledky do jednoho tvaru,
- spočítá metriky a hodnocení,
- vrátí JSON s per-source statistikami (počet, čas, případná chyba).

CSV export = client-side převod načtených dat na soubor.

## Co bude fáze 2 (mimo tento plán)

- Napojení Firecrawl konektoru a aktivace browser zdrojů.
- Případné přepnutí Sreality na Firecrawl, pokud nás blokuje.
- (Volitelně) ukládání do Lovable Cloud + favority + historie cen.

## Poznámka před buildem

Firecrawl konektor je placený (free tier ~500 scrapů/měsíc). V fázi 1 ho nepotřebujeme — Sreality/Bazoš/Bezrealitky jedou přes čistý `fetch`. Aktivujeme ho až ve fázi 2.
