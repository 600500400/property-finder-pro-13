// Denní cache benchmarku tržního nájemného per OKRES.
// Strategie: 1× za 24 h stáhne 500 aktuálních inzerátů pronájmu bytů ze Sreality,
// bucketuje podle detekovaného okresu, spočítá medián Kč/m². Když nestačí samples,
// použije statickou tabulku (Deloitte 2024 + ČSÚ).
import { okresFromLocality, OKRESY, OKRES_BY_SLUG } from "./okresy";

const TTL_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLES = 8;

export interface OkresStat {
  perM2: number;
  samples: number;
  source: "live" | "static";
}

export interface RentBenchmark {
  // Pražské obvody / Brno-části / krajská města (city-level)
  district: Record<string, number>;
  // 77 okresů
  okres: Record<string, OkresStat>;
  // Kraje (krajský průměr fallback)
  region: Record<string, number>;
  fetched_at: string;
  source: string;
  live_okresy: number;
  static_okresy: number;
}

const RENT_PER_M2_REGION: Record<string, number> = {
  praha: 415, stredocesky: 290, jihocesky: 260, jihomoravsky: 330,
  karlovarsky: 205, kralovehradecky: 240, liberecky: 245, moravskoslezsky: 230,
  olomoucky: 235, pardubicky: 235, plzensky: 280, ustecky: 195,
  vysocina: 215, zlinsky: 225, "": 270,
};

// City-level (pražské obvody, Brno-části, Plzeň-N, Ostrava-části) — přesnější než okres pro velká města
const RENT_PER_M2_DISTRICT: Record<string, number> = {
  "praha-1": 510, "praha-2": 470, "praha-3": 430, "praha-4": 380, "praha-5": 400,
  "praha-6": 420, "praha-7": 425, "praha-8": 380, "praha-9": 360, "praha-10": 350,
  "praha-11": 340, "praha-12": 335, "praha-13": 345, "praha-14": 320, "praha-15": 320,
  "praha-16": 310, "praha-17": 320, "praha-18": 330, "praha-19": 320, "praha-20": 305,
  "praha-21": 305, "praha-22": 305,
  "brno-stred": 380, "brno-mesto": 360, "brno-sever": 340, "brno-jih": 320,
  "brno-vychod": 310, "brno-zapad": 320,
  "plzen-1": 295, "plzen-2": 280, "plzen-3": 285, "plzen-4": 270,
  "ostrava-poruba": 245, "ostrava-jih": 230, "ostrava-mesto": 240,
};

interface CacheSlot {
  data: RentBenchmark;
  fetched_at: number;
}

const g = globalThis as unknown as { __rentBench?: CacheSlot };

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

async function fetchSrealityRentSample(): Promise<Array<{ price: number; area: number; locality: string }>> {
  const out: Array<{ price: number; area: number; locality: string }> = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
    "Accept-Language": "cs-CZ,cs;q=0.9",
    "Referer": "https://www.sreality.cz/hledani/pronajem/byty",
  };
  // 5× 100 inzerátů = 500
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({
      category_main_cb: "1",
      category_type_cb: "2",
      locality_country_id: "112",
      per_page: "100",
      page: String(page + 1),
    });
    try {
      const r = await fetch(`https://www.sreality.cz/api/cs/v2/estates?${qs}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) break;
      const data: any = await r.json();
      const list = data._embedded?.estates || data.results || [];
      if (!Array.isArray(list) || list.length === 0) break;
      for (const e of list) {
        const priceV = e?.price_czk?.value_raw ?? e?.price?.value_raw ?? e?.price;
        const price = typeof priceV === "number" ? priceV : parseInt(String(priceV || 0), 10);
        const area = typeof e?.usable_area === "number" ? e.usable_area : 0;
        const locObj = e?.locality;
        const locStr = typeof locObj === "string"
          ? locObj
          : [locObj?.city, locObj?.citypart].filter(Boolean).join(" ");
        if (price > 1000 && price < 200000 && area > 10 && area < 500 && locStr) {
          out.push({ price, area, locality: locStr });
        }
      }
    } catch (e) {
      console.warn(`[rent-benchmark] sreality page ${page + 1} failed:`, e instanceof Error ? e.message : e);
      break;
    }
  }
  return out;
}

async function refreshBenchmark(): Promise<RentBenchmark> {
  const samples = await fetchSrealityRentSample();
  console.log(`[rent-benchmark] fetched ${samples.length} rental samples from Sreality`);

  // Bucketování per okres
  const buckets: Record<string, number[]> = {};
  for (const s of samples) {
    const okres = okresFromLocality(s.locality);
    if (!okres) continue;
    const perM2 = s.price / s.area;
    if (perM2 < 80 || perM2 > 900) continue; // sanity: extrémy ven
    (buckets[okres] ||= []).push(perM2);
  }

  const okres: Record<string, OkresStat> = {};
  let live = 0, stat = 0;
  for (const info of OKRESY) {
    const arr = buckets[info.slug] || [];
    if (arr.length >= MIN_SAMPLES) {
      okres[info.slug] = { perM2: median(arr), samples: arr.length, source: "live" };
      live++;
    } else {
      okres[info.slug] = { perM2: info.static_rent_per_m2, samples: arr.length, source: "static" };
      stat++;
    }
  }
  void OKRES_BY_SLUG;

  console.log(`[rent-benchmark] okres breakdown: live=${live} static=${stat}`);
  return {
    district: RENT_PER_M2_DISTRICT,
    okres,
    region: RENT_PER_M2_REGION,
    fetched_at: new Date().toISOString(),
    source: live > 0 ? `sreality-live+static (${live}/${OKRESY.length} live)` : "static-2024",
    live_okresy: live,
    static_okresy: stat,
  };
}

export async function getBenchmark(): Promise<RentBenchmark> {
  const now = Date.now();
  if (g.__rentBench && now - g.__rentBench.fetched_at < TTL_MS) {
    return g.__rentBench.data;
  }
  const data = await refreshBenchmark();
  g.__rentBench = { data, fetched_at: now };
  return data;
}
