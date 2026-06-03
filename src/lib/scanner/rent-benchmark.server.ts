// Denní cache benchmarku tržního nájemného. Aktuálně používá statickou tabulku
// z valuation.ts; do budoucna lze hookem napojit live scrape Sreality pronájmů.
import { staticBenchmark, type RentBenchmark } from "./valuation";

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheSlot {
  data: RentBenchmark;
  fetched_at: number;
}

const g = globalThis as unknown as { __rentBench?: CacheSlot };

async function refreshBenchmark(): Promise<RentBenchmark> {
  // TODO: live scrape (Firecrawl) pronájmů ze sreality.cz a zprůměrovat per district.
  return staticBenchmark();
}

export async function getBenchmark(): Promise<RentBenchmark> {
  const now = Date.now();
  if (g.__rentBench && now - g.__rentBench.fetched_at < TTL_MS) {
    return g.__rentBench.data;
  }
  const data = await refreshBenchmark();
  g.__rentBench = { data, fetched_at: now };
  console.log(`[rent-benchmark] refreshed source=${data.source} districts=${Object.keys(data.district).length}`);
  return data;
}
