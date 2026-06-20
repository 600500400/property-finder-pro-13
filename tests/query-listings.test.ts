import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- controllable state ----
let mockTier: "anonymous" | "free" | "premium" = "anonymous";
const limitCalls: number[] = [];
const ltCalls: Array<{ col: string; val: string }> = [];

vi.mock("@/lib/billing/premium.server", () => ({
  viewerTier: async () => ({ tier: mockTier, userId: mockTier === "anonymous" ? null : "u1" }),
}));

vi.mock("@/lib/scanner/rent-benchmark.server", () => ({
  getBenchmark: async () => ({
    district: {}, okres: {},
    region: { praha: 415, "": 270 },
    fetched_at: new Date().toISOString(),
    source: "test", live_okresy: 0, static_okresy: 0,
  }),
}));

function makeQB(rows: unknown[]) {
  const qb: Record<string, unknown> = {};
  const passthrough = () => qb;
  Object.assign(qb, {
    select: passthrough,
    eq: passthrough,
    in: passthrough,
    gte: passthrough,
    lte: passthrough,
    not: passthrough,
    order: passthrough,
    lt: (col: string, val: string) => { ltCalls.push({ col, val }); return qb; },
    limit: (n: number) => { limitCalls.push(n); return qb; },
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  });
  return qb;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => makeQB([]),
  },
}));

describe("queryListings — tier caps & 24h delay gate", () => {
  beforeEach(() => {
    limitCalls.length = 0;
    ltCalls.length = 0;
  });

  const baseFilters = {
    deal_type: "prodej" as const,
    property_type: "byty" as const,
    sub_type: "" as const,
    region: "praha" as const,
    sources: [],
    sort_by: "date_desc" as const,
    freshness: "" as const,
  };

  it("anonymous → cap 20 + 24h delay applied", async () => {
    mockTier = "anonymous";
    const { queryListings } = await import("@/lib/listings/query.functions");
    await queryListings({ data: baseFilters });
    expect(limitCalls[0]).toBe(20);
    expect(ltCalls.some(c => c.col === "first_seen_at")).toBe(true);
  });

  it("free (registered) → cap 50 + 24h delay applied", async () => {
    mockTier = "free";
    const { queryListings } = await import("@/lib/listings/query.functions");
    await queryListings({ data: baseFilters });
    expect(limitCalls[0]).toBe(50);
    expect(ltCalls.some(c => c.col === "first_seen_at")).toBe(true);
  });

  it("premium → cap 500 and NO 24h delay gate", async () => {
    mockTier = "premium";
    const { queryListings } = await import("@/lib/listings/query.functions");
    await queryListings({ data: baseFilters });
    expect(limitCalls[0]).toBe(500);
    expect(ltCalls.some(c => c.col === "first_seen_at")).toBe(false);
  });

  it("meta.tier and meta.result_cap echo the resolved tier", async () => {
    mockTier = "free";
    const { queryListings } = await import("@/lib/listings/query.functions");
    const res = await queryListings({ data: baseFilters });
    expect(res.meta?.tier).toBe("free");
    expect(res.meta?.result_cap).toBe(50);
    expect(res.meta?.is_premium).toBe(false);
  });
});
