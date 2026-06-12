import { describe, it, expect } from "vitest";
import { matchesSearch, type MatchListing, type SavedSearchRow, type MatchContext } from "@/lib/alerts/match.server";

const baseListing: MatchListing = {
  source: "sreality",
  title: "Byt 2+kk Praha 9",
  price: 5_900_000,
  deal_type: "prodej",
  property_type: "byty",
  kraj: "praha",
  city: "Praha 9",
  area_m2: 55,
  ownership: "osobni",
  url: "https://example.com/x",
  image_url: null,
};

function search(overrides: Partial<SavedSearchRow>): SavedSearchRow {
  return {
    id: "s1", user_id: "u1", name: "test",
    filters: {}, min_yield: null, frequency: "daily", is_active: true,
    ...overrides,
  };
}

describe("matchesSearch", () => {
  it("matches when no filters set", () => {
    expect(matchesSearch(baseListing, search({}))).toBe(true);
  });

  it("rejects wrong region", () => {
    expect(matchesSearch(baseListing, search({ filters: { region: "brno" } }))).toBe(false);
  });

  it("matches matching region", () => {
    expect(matchesSearch(baseListing, search({ filters: { region: "praha" } }))).toBe(true);
  });

  it("rejects when price above max", () => {
    expect(matchesSearch(baseListing, search({ filters: { price_max: 5_000_000 } }))).toBe(false);
  });

  it("rejects when price below min", () => {
    expect(matchesSearch(baseListing, search({ filters: { price_min: 6_000_000 } }))).toBe(false);
  });

  it("rejects when source not in sources[]", () => {
    expect(matchesSearch(baseListing, search({ filters: { sources: ["bazos"] } }))).toBe(false);
  });

  it("rejects inactive search", () => {
    expect(matchesSearch(baseListing, search({ is_active: false }))).toBe(false);
  });

  it("rejects when min_yield set but no ctx provided (cannot verify)", () => {
    // Without context we cannot compute yield; treat as no-match for safety
    const ctx: MatchContext = {
      bench: {
        district: {}, okres: {}, region: { praha: 415, "": 270 },
        fetched_at: new Date().toISOString(), source: "test",
        live_okresy: 0, static_okresy: 0,
      },
      rentIndex: new Map(),
    };
    // 5.9M / (55 * 415 * 12) ≈ 4.65% gross → net ≈ 3.95% → below 5% threshold
    expect(matchesSearch(baseListing, search({ min_yield: 5 }), ctx)).toBe(false);
  });
});
