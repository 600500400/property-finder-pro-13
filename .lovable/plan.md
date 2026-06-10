
# Etapa 1 — Centralizovaný scheduled scraping (revize po feedbacku)

## Změny oproti původnímu plánu
1. **Per-combo granularita** — každý cron tick = jedna kombinace `(dealType, propertyType)`. Endpoint přijímá JSON body, `runSourceScrape(sourceKey, dealType, propertyType)`.
2. **Redukovaná matice pro Firecrawl** — jen `byty + domy` × `prodej + pronajem` = 4 combos/zdroj.
3. **Cron volá published URL**, nikoli preview. Komentář v INSERT SQL: po každém publish/změně domény URL re-verify.
4. **URL normalizace** ve `deriveExternalId` (strip query/hash) před SHA1 fallbackem.
5. **`try/finally`** v `runSourceScrape` — žádný řádek v `scrape_runs` nesmí zůstat ve `status='running'`.

## 1. Databáze (1 migrace)

**`public.listings`** + **`public.scrape_runs`** (sloupce, indexy, RLS, GRANTy beze změn proti minulé verzi). Klíčové:
- `unique (source, external_id)`, `price_per_m2` generated column, `is_active` pro soft-delete po 7 dnech.
- `scrape_runs` přidáno: `deal_type text`, `property_type text` (sloupce pro per-combo logging).
- RLS: `listings` SELECT only `authenticated`; `scrape_runs` SELECT `authenticated`. Mutace přes `service_role`.

## 2. Per-source TanStack routes

`src/routes/api/public/cron/scrape-<source>.ts` (7 souborů). Každá:
```ts
POST → {
  verifyCronSecret(request);
  const { dealType, propertyType } = await request.json();
  const result = await runSourceScrape('sreality', dealType, propertyType);
  return Response.json(result);
}
```

**`src/lib/scanner/persist.server.ts`**:
- `runSourceScrape(sourceKey, dealType, propertyType)`:
  1. `insert scrape_runs (status='running', source, deal_type, property_type)` → uloženo `runId`.
  2. `try { … } catch { update status='error', error_message } finally { pokud status ještě 'running', update na 'error' s "unexpected termination" }` — garantuje žádný věčný `running` řádek.
  3. Sestaví `ScanFilters` se zadanou kombinací (`region=""`, prázdný `price_min/max`, vysoký `per_source_limit`).
  4. Zavolá existující `HTTP_FETCHERS[sourceKey](filters)`.
  5. Pro každý `Listing`: `resolveOwnership`, `deriveExternalId(source, url)` (viz níže).
  6. `UPSERT` do `listings` přes `(source, external_id)`: insert → `first_seen_at=now`, existing → refresh `last_seen_at`, price, title, raw_data, `is_active=true`.
  7. Soft-delete: `UPDATE listings SET is_active=false WHERE source=$1 AND deal_type=$2 AND property_type=$3 AND last_seen_at < now() - interval '7 days'`.
  8. `update scrape_runs (status='success', counters, duration_ms, finished_at=now)`.

**`src/lib/scanner/external-id.ts`**:
```ts
export function deriveExternalId(source: string, url: string): string {
  // 1) Pokud URL má numerické ID v posledním segmentu → použij ho.
  // 2) Jinak normalizuj URL: strip query string a hash, lowercase host,
  //    trailing slash → '', a vrať SHA1(prvních 16 znaků).
}
```

**`src/lib/scanner/cron-auth.server.ts`**: konstantní porovnání `Authorization: Bearer <CRON_SECRET>`.

## 3. Plánování cronu (pg_cron)

INSERT SQL s komentářem:
```sql
-- DŮLEŽITÉ: Po každém publish projektu nebo změně domény ověř, že tato URL
-- stále vede na PUBLISHED build (https://property-finder-pro-13.lovable.app),
-- nikoli na preview. Při změně URL re-INSERT s novými hodnotami.
```

**Fast (sreality, bezrealitky, bazos)** — plná matice `prodej/pronajem × byty/domy/pozemky/komercni/ostatni` = 10 combos × 3 zdroje = 30 cron jobů, každé 3 h, limit 100.

**Firecrawl (hyperinzerce, realitymix, annonce, idnes)** — redukovaná matice `prodej/pronajem × byty/domy` = 4 combos × 4 zdroje = 16 cron jobů, každých 12 h, limit 50.

Spread po minutách (např. fast: `0,2,4,…,28 */3 * * *`, firecrawl: `0,3,6,…,45 */12 * * *`) — žádné dva combos pro stejný zdroj neběží zároveň.

**Očekávané Firecrawl náklady:**
- 4 zdroje × 4 combos × 2 běhy/den × 50 listingů/combo = **1 600 listing-fetches/den** (max strop). Reálně se cap stane plnit jen u větších kategorií (byty/prodej) → ~800–1 200 req/den.
- Pro porovnání: současný live-scan při jednom kliknutí vytáhne 20/zdroj × 4 zdroje = 80 req. Nový model = ekvivalent ~10–15 user-klikání/den, ale rozprostřený.

## 4. Ověření po nasazení

1. Manuální curl na každý ze 7 endpointů se vzorovým body `{"dealType":"prodej","propertyType":"byty"}` → status 200, `scrape_runs` row `status='success'`, `items_found > 0`.
2. `SELECT source, deal_type, property_type, count(*) FROM listings GROUP BY 1,2,3` — všechny očekávané kombinace mají řádky.
3. `SELECT * FROM cron.job WHERE jobname LIKE 'scrape-%'` — 46 jobů registrovaných (30 fast + 16 firecrawl).
4. Re-run téhož combo → převažuje `items_updated`, ne `items_new`.
5. Záměrný error (např. dočasně shodit CRON_SECRET) → `scrape_runs.status='error'` během vteřin, nikdy `running` na déle než trvání jednoho běhu.
6. RLS smoke test: anonymous `select` na `listings` selže, authenticated projde.

## Soubory

**Nové:**
- `src/lib/scanner/persist.server.ts`
- `src/lib/scanner/external-id.ts`
- `src/lib/scanner/cron-auth.server.ts`
- `src/routes/api/public/cron/scrape-{sreality,bezrealitky,bazos,hyperinzerce,realitymix,annonce,idnes}.ts`

**Editované:** žádné — stávající `sources/*.server.ts`, `ownership.ts`, `valuation.ts`, `rent-benchmark.server.ts` se re-usují beze změny. UI nedotýkat.

**Migrace:** 1× (tabulky + RLS + GRANTy + indexy).
**Insert SQL** (ne migrace): 46× `cron.schedule(...)` s komentem o re-verify URL.
**Secret:** `CRON_SECRET` (přes `add_secret`, 32B random).

