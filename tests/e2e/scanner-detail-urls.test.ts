/**
 * E2E integration test: ověřuje, že každý scraper vrací u inzerátu
 *  - URL, která ukazuje přímo na detail (ne kategorii/seznam),
 *  - obrázek, který je dostupný a má MIME typ image/*.
 *
 * Spuštění:   bunx vitest run tests/e2e/scanner-detail-urls.test.ts
 *
 * Pozn.: testy volají skutečné externí zdroje, takže můžou občas selhat
 * kvůli rate-limitu nebo výpadku zdroje. Pro Firecrawl-based zdroje
 * (idnes, realitymix) se test přeskočí, pokud chybí FIRECRAWL_API_KEY.
 */
import { describe, it, expect } from "vitest";
import type { Listing, ScanFilters, SourceKey } from "../../src/lib/scanner/types";
import { fetchSreality } from "../../src/lib/scanner/sources/sreality.server";
import { fetchBazos } from "../../src/lib/scanner/sources/bazos.server";
import { fetchBezrealitky } from "../../src/lib/scanner/sources/bezrealitky.server";
import { fetchAnnonce } from "../../src/lib/scanner/sources/annonce.server";
import { fetchHyperinzerce } from "../../src/lib/scanner/sources/hyperinzerce.server";
import { fetchIdnes, fetchRealityMix } from "../../src/lib/scanner/sources/firecrawl.server";

// Stejný whitelist jako v scan.functions.ts – kdyby se tam změnil, sjednoťte.
const DETAIL_URL_PATTERN: Record<SourceKey, RegExp> = {
  sreality: /sreality\.cz\/(detail|hledani)\/.+\/\d+/i,
  bazos: /reality\.bazos\.cz\/inzerat\//i,
  bezrealitky: /bezrealitky\.cz\/nemovitosti-byty-domy\/[^/]+/i,
  annonce: /annonce\.cz\/inzerat\//i,
  hyperinzerce: /hyperinzerce\.cz\/.+\/.+-\d+\.html/i,
  idnes: /reality\.idnes\.cz\/detail\//i,
  realitymix: /realitymix\.cz\/detail\//i,
};

const baseFilters: ScanFilters = {
  deal_type: "prodej",
  property_type: "byty",
  sub_type: "",
  region: "",
  sources: [],
  sort_by: "source",
  per_source_limit: 3,
};

type SrcCfg = {
  key: SourceKey;
  label: string;
  fetch: (f: ScanFilters) => Promise<Listing[]>;
  requiresFirecrawl?: boolean;
};

const SOURCES: SrcCfg[] = [
  { key: "sreality", label: "Sreality", fetch: fetchSreality },
  { key: "bazos", label: "Bazoš", fetch: fetchBazos },
  { key: "bezrealitky", label: "Bezrealitky", fetch: fetchBezrealitky },
  { key: "annonce", label: "Annonce", fetch: fetchAnnonce },
  { key: "hyperinzerce", label: "Hyperinzerce", fetch: fetchHyperinzerce },
  { key: "idnes", label: "iDnes Reality", fetch: fetchIdnes, requiresFirecrawl: true },
  { key: "realitymix", label: "RealityMix", fetch: fetchRealityMix, requiresFirecrawl: true },
];

async function headOk(url: string): Promise<{ ok: boolean; type: string | null; status: number }> {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) });
    // Některé CDN nepodporují HEAD → fallback na GET (jen pár bytů přes Range).
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(10000) });
    }
    return { ok: res.ok, type: res.headers.get("content-type"), status: res.status };
  } catch (e) {
    return { ok: false, type: null, status: 0 };
  }
}

describe("Scanner: detail URL + image pro každý zdroj", () => {
  for (const src of SOURCES) {
    const itFn =
      src.requiresFirecrawl && !process.env.FIRECRAWL_API_KEY ? it.skip : it;

    itFn(
      `${src.label}: vrátí inzeráty, URL ukazuje na detail a obrázek je načtený`,
      async () => {
        const listings = await src.fetch({ ...baseFilters, sources: [src.key] });
        expect(listings.length, `${src.label} nevrátil žádný inzerát`).toBeGreaterThan(0);

        const re = DETAIL_URL_PATTERN[src.key];
        const badUrls = listings.filter(l => !l.url || !re.test(l.url));
        expect(
          badUrls,
          `${src.label} URL nematchuje detail regex: ${badUrls.map(l => l.url).join(", ")}`,
        ).toHaveLength(0);

        // Vezmeme první inzerát s obrázkem a ověříme, že je dostupný.
        const withImg = listings.find(l => !!l.img);
        expect(withImg, `${src.label} žádný inzerát nemá img`).toBeTruthy();
        const check = await headOk(withImg!.img);
        expect(
          check.ok && (check.type ?? "").startsWith("image/"),
          `${src.label} obrázek ${withImg!.img} se nenačetl (status=${check.status}, type=${check.type})`,
        ).toBe(true);
      },
      45_000,
    );
  }
});
