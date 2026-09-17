import { describe, expect, it } from "vitest";
import krajRows from "@/data/csu-kraj-validation.json";
import {
  buildCsuIndexes, computeCsuHouseCompare, municipalityFromLocality,
  normalizeCzechName, type CsuKrajRow, type CsuOkresRow, type PopulationRow,
} from "@/lib/listings/csu-benchmark";

describe("ČSÚ house benchmark", () => {
  it("uses exact normalized municipality matches, never prefixes", () => {
    expect(normalizeCzechName("Mikulov")).toBe("mikulov");
    expect(normalizeCzechName("Mikulovice")).not.toBe(normalizeCzechName("Mikulov"));
    expect(municipalityFromLocality("Brno-Žabovřesky")).toBe("brno");
    expect(municipalityFromLocality("Praha – Záběhlice")).toBe("praha");
  });

  it("falls back to the okres 2025 total for a suppressed band", () => {
    const okres: CsuOkresRow[] = [
      { kraj: "stredocesky", okres: "benesov", level: "okres", avg_size_m2: 100, price_2025: 56708, band: "do1999", band_price_uplifted: null },
    ];
    const population: PopulationRow[] = [
      { kraj: "stredocesky", name: "Sázava", name_norm: "sazava", population: 1000, is_ambiguous_in_kraj: false },
    ];
    const result = computeCsuHouseCompare({ kraj: "stredocesky", locality: "Sázava", areaM2: 100, price: 5_670_800, indexes: buildCsuIndexes(okres, [], population) });
    expect(result?.scope).toBe("okres");
    expect(result?.benchmark_per_m2).toBe(56708);
  });

  it("keeps the municipality band when falling back to kraj", () => {
    const kraj: CsuKrajRow[] = [
      { kraj: "stredocesky", band: "2000_9999", price_2025: 85552, avg_size_m2: 95 },
    ];
    const population: PopulationRow[] = [
      { kraj: "stredocesky", name: "Testov", name_norm: "testov", population: 5000, is_ambiguous_in_kraj: false },
    ];
    const result = computeCsuHouseCompare({ kraj: "stredocesky", locality: "Testov", areaM2: 95, price: 8_555_200, indexes: buildCsuIndexes([], kraj, population) });
    expect(result?.scope).toBe("kraj_band");
    expect(result?.benchmark_per_m2).toBe(85552);
  });

  it("marks a floor area far off the typical size of its own band", () => {
    const okres: CsuOkresRow[] = [{ kraj: "praha", okres: "praha", level: "okres", avg_size_m2: 98, price_2025: 119239, band: "50000_plus", band_price_uplifted: 119239 }];
    const calibration = [{ size_band: "100_150" as const, median_ratio: 1, factor: 1, typical_area_m2: 90, sample_count: 100 }];
    const result = computeCsuHouseCompare({ kraj: "praha", locality: "Praha – Záběhlice", areaM2: 148, price: 17_645_000, indexes: buildCsuIndexes(okres, [], [], calibration) });
    expect(result?.area_warning).toBe(true);
  });

  it("weakens a benchmark that ČSÚ marked as low-sample", () => {
    const okres: CsuOkresRow[] = [
      { kraj: "jihocesky", okres: "pisek", level: "okres", avg_size_m2: 81, price_2025: 43222, band: "do1999", band_price_uplifted: null },
      { kraj: "jihocesky", okres: "pisek", level: "okres", avg_size_m2: 81, price_2025: 43222, band: "2000_9999", band_price_uplifted: 35466, low_sample: true },
    ];
    const population: PopulationRow[] = [
      { kraj: "jihocesky", name: "Mirovice", name_norm: "mirovice", population: 5000, is_ambiguous_in_kraj: false },
    ];
    const result = computeCsuHouseCompare({ kraj: "jihocesky", locality: "Mirovice, okres Písek", areaM2: 120, price: 4_500_000, indexes: buildCsuIndexes(okres, [], population) });
    expect(result?.scope).toBe("okres_band");
    expect(result?.benchmark_per_m2).toBe(35466);
    expect(result?.benchmark_low_sample).toBe(true);
  });

  it("auto-derives kraj from village name in populationByName and falls back to kraj_band", () => {
    const kraj: CsuKrajRow[] = [
      { kraj: "stredocesky", band: "do1999", price_2025: 45000, avg_size_m2: 110 },
      { kraj: "stredocesky", band: null, price_2025: 55000, avg_size_m2: 115 },
    ];
    const population: PopulationRow[] = [
      { kraj: "stredocesky", name: "Sloveč", name_norm: "slovec", population: 520, is_ambiguous_in_kraj: false },
    ];
    const result = computeCsuHouseCompare({
      kraj: null,
      locality: "Sloveč",
      areaM2: 120,
      price: 4_800_000,
      indexes: buildCsuIndexes([], kraj, population),
    });
    expect(result).not.toBeNull();
    expect(result?.scope).toBe("kraj_band");
    expect(result?.benchmark_per_m2).toBe(45000);
    expect(result?.verdict).toBeDefined();
    expect(result?.verdict_label).toBeDefined();
  });
});

describe("ČSÚ uplift validation", () => {
  it("reproduces kraj × band 2025 values with mean absolute error below 4%", () => {
    const rows = krajRows as Array<{ kraj: string; band: string | null; price_2025: number | null; price_avg: number | null }>;
    const totals = new Map(rows.filter(r => !r.band).map(r => [r.kraj, r]));
    const errors = rows.filter(r => r.band && r.price_2025 && r.price_avg).flatMap(row => {
      const total = totals.get(row.kraj);
      if (!total?.price_2025 || !total.price_avg || !row.price_2025 || !row.price_avg) return [];
      const estimate = row.price_avg * (total.price_2025 / total.price_avg);
      return [Math.abs(estimate / row.price_2025 - 1) * 100];
    });
    const sorted = [...errors].sort((a, b) => a - b);
    const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const max = Math.max(...errors);
    console.info("ČSÚ uplift validation", { combinations: errors.length, mean, median, max });
    expect(mean).toBeLessThan(4);
  });
});