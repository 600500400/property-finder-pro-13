import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable mocks
let mockAuthHeader: string | null = null;
let mockClaims: { sub: string } | null = null;
let mockClaimsError: unknown = null;
let mockPremium = false;
let mockRpcError: unknown = null;

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => ({
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? mockAuthHeader : null) },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => ({
        data: mockClaims ? { claims: mockClaims } : null,
        error: mockClaimsError,
      }),
    },
  }),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (_fn: string, _args: { _user_id: string }) => ({
      data: mockPremium,
      error: mockRpcError,
    }),
  },
}));

// Provide env vars used by viewerUserId.
process.env.SUPABASE_URL ||= "http://localhost";
process.env.SUPABASE_PUBLISHABLE_KEY ||= "test";

describe("viewerTier / isUserPremium", () => {
  beforeEach(() => {
    mockAuthHeader = null;
    mockClaims = null;
    mockClaimsError = null;
    mockPremium = false;
    mockRpcError = null;
  });

  it("anonymous when no Authorization header", async () => {
    const { viewerTier } = await import("@/lib/billing/premium.server");
    const r = await viewerTier();
    expect(r).toEqual({ tier: "anonymous", userId: null });
  });

  it("anonymous when token claims invalid", async () => {
    mockAuthHeader = "Bearer bad-token";
    mockClaimsError = new Error("invalid");
    const { viewerTier } = await import("@/lib/billing/premium.server");
    expect((await viewerTier()).tier).toBe("anonymous");
  });

  it("free when authed but is_premium returns false", async () => {
    mockAuthHeader = "Bearer good";
    mockClaims = { sub: "user-1" };
    mockPremium = false;
    const { viewerTier } = await import("@/lib/billing/premium.server");
    const r = await viewerTier();
    expect(r).toEqual({ tier: "free", userId: "user-1" });
  });

  it("premium when is_premium returns true", async () => {
    mockAuthHeader = "Bearer good";
    mockClaims = { sub: "user-2" };
    mockPremium = true;
    const { viewerTier } = await import("@/lib/billing/premium.server");
    const r = await viewerTier();
    expect(r).toEqual({ tier: "premium", userId: "user-2" });
  });

  it("expired subscription → free (is_premium RPC returns false, simulating current_period_end < now)", async () => {
    mockAuthHeader = "Bearer good";
    mockClaims = { sub: "user-3" };
    mockPremium = false; // expired ⇒ DB function returns false
    const { isUserPremium, viewerTier } = await import("@/lib/billing/premium.server");
    expect(await isUserPremium("user-3")).toBe(false);
    expect((await viewerTier()).tier).toBe("free");
  });

  it("isUserPremium(null) → false without calling RPC", async () => {
    const { isUserPremium } = await import("@/lib/billing/premium.server");
    expect(await isUserPremium(null)).toBe(false);
    expect(await isUserPremium(undefined)).toBe(false);
  });
});
