import { describe, it, expect } from "vitest";
import { indexRentComps, estimateRentFromComps, computeHybridYield, type RentComp } from "@/lib/listings/yield.server";
import type { RentBenchmark } from "@/lib/scanner/rent-benchmark.server";

const bench: RentBenchmark = {
  district: {}, okres: {},
  region: { praha: 415, "": 270 },
  fetched_at: new Date().toISOString(), source: "test", live_okresy: 0, static_okresy: 0,
};

function comps(area: number, price: number, n: number): RentComp[] {
  return Array.from({ length: n }, () => ({ kraj: "praha", property_type: "byty", area_m2: area, price }));
}

describe("estimateRentFromComps", () => {
  it("returns null when fewer than 5 comparable comps", () => {
    const idx = indexRentComps(comps(60, 20000, 4));
    expect(estimateRentFromComps("praha", "byty", 60, idx)).toBeNull();
  });

  it("returns median of comps within ±20% area", () => {
    const rents: RentComp[] = [
      ...comps(55, 18000, 2),
      ...comps(60, 20000, 3),
      ...comps(65, 22000, 2),
      ...comps(100, 50000, 5), // out of range
    ];
    const idx = indexRentComps(rents);
    const r = estimateRentFromComps("praha", "byty", 60, idx);
    expect(r).not.toBeNull();
    expect(r!.samples).toBeGreaterThanOrEqual(5);
    expect(r!.monthly).toBe(20000);
  });
});

describe("computeHybridYield", () => {
  it("uses comparable rents when ≥5 available (live path)", () => {
    const idx = indexRentComps(comps(60, 25000, 6));
    const inv = computeHybridYield({
      price: 6_000_000, region: "praha", propertyType: "byty",
      areaM2: 60, name: "2+kk", locality: "Praha 9",
      ownership: "osobni", kraj: "praha", bench, rentIndex: idx,
    });
    expect(inv).not.toBeNull();
    expect(inv!.monthly_rent).toBe(25000);
    expect(inv!.rent_basis_label).toMatch(/srovnatelných pronájmů/i);
  });

  it("falls back to static benchmark when no comps", () => {
    const inv = computeHybridYield({
      price: 6_000_000, region: "praha", propertyType: "byty",
      areaM2: 60, name: "2+kk", locality: "Praha 9",
      ownership: "osobni", kraj: "praha", bench, rentIndex: new Map(),
    });
    expect(inv).not.toBeNull();
    expect(inv!.rent_basis_label).toMatch(/Kč\/m²/);
  });

  it("returns null when area is unknown", () => {
    const inv = computeHybridYield({
      price: 5_000_000, region: "praha", propertyType: "byty",
      areaM2: null, name: "byt", locality: "",
      ownership: "osobni", kraj: "praha", bench, rentIndex: new Map(),
    });
    expect(inv).toBeNull();
  });
});
