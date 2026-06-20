import { describe, it, expect } from "vitest";
import { calcYield } from "@/lib/scanner/valuation";
import type { RentBenchmark } from "@/lib/scanner/rent-benchmark.server";

const bench: RentBenchmark = {
  district: { "praha-9": 360 },
  okres: {},
  region: { praha: 415, jihomoravsky: 330, "": 270 },
  fetched_at: new Date().toISOString(),
  source: "test",
  live_okresy: 0,
  static_okresy: 0,
};

describe("calcYield (static / benchmark fallback path)", () => {
  it("computes gross & net yield using district-level rent (Praha 9)", () => {
    const r = calcYield(5_000_000, "praha", "byty", 60, "2+kk", "Praha 9", "osobni", bench);
    // perM2 = 360, disp(2+kk)=1.05, type=1.0 → 378 Kč/m² → monthly = 378*60 = 22 680
    // gross = 22680*12/5_000_000 *100 = 5.44 %  → net = 4.62
    expect(r).not.toBeNull();
    expect(r!.monthly_rent).toBe(22680);
    expect(r!.gross_yield).toBeCloseTo(5.44, 1);
    expect(r!.net_yield).toBeCloseTo(4.62, 1);
    expect(r!.stars).toBe(3);
  });

  it("falls back to region benchmark when no district/okres match (Jihomoravský)", () => {
    const r = calcYield(3_000_000, "jihomoravsky", "byty", 50, "3+kk", "Neznámá obec", "osobni", bench);
    // perM2 = 330 * 1.0(disp 3+kk) = 330 → monthly = 16 500
    expect(r).not.toBeNull();
    expect(r!.monthly_rent).toBe(16500);
    expect(r!.rent_source).toBe("region");
  });

  it("applies the družstevní 0.92x discount on monthly rent", () => {
    const osobni = calcYield(4_000_000, "praha", "byty", 50, "2+kk", "Praha 9", "osobni", bench)!;
    const druz = calcYield(4_000_000, "praha", "byty", 50, "2+kk", "Praha 9", "druzstevni", bench)!;
    expect(druz.monthly_rent).toBe(Math.round(osobni.monthly_rent * 0.92));
    expect(druz.net_yield).toBeLessThan(osobni.net_yield);
  });

  it("returns null for invalid / missing price", () => {
    expect(calcYield(0, "praha", "byty", 60, "2+kk", "Praha", "osobni", bench)).toBeNull();
    expect(calcYield(5000, "praha", "byty", 60, "2+kk", "Praha", "osobni", bench)).toBeNull();
  });

  it("rating bands: ≥6% → 5★, ≥5% → 4★, <3% → 1★", () => {
    // Force ~5★ via very low price
    const high = calcYield(2_500_000, "praha", "byty", 60, "2+kk", "Praha 9", "osobni", bench)!;
    expect(high.stars).toBeGreaterThanOrEqual(4);
    // Force 1★ via very high price
    const low = calcYield(20_000_000, "praha", "byty", 60, "2+kk", "Praha 9", "osobni", bench)!;
    expect(low.stars).toBe(1);
  });
});
