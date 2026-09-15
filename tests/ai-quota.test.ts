import { describe, it, expect } from "vitest";
import { mapReservation, type ReservationRow } from "@/lib/ai/quota";

const row = (o: Partial<ReservationRow>): ReservationRow => ({
  allowed: false,
  used: 0,
  quota_limit: 1,
  reservation_id: null,
  ...o,
});

describe("mapReservation", () => {
  it("maps an allowed free reservation", () => {
    const out = mapReservation(
      [row({ allowed: true, used: 1, quota_limit: 1, reservation_id: "r1" })],
      null,
    );
    expect(out).toEqual({ ok: true, used: 1, limit: 1, isPremium: false, reservationId: "r1" });
  });

  it("maps an allowed premium reservation", () => {
    const out = mapReservation(
      [row({ allowed: true, used: 7, quota_limit: 50, reservation_id: "r2" })],
      null,
    );
    expect(out).toEqual({ ok: true, used: 7, limit: 50, isPremium: true, reservationId: "r2" });
  });

  it("refuses a free user who already spent the sample", () => {
    const out = mapReservation([row({ allowed: false, used: 1, quota_limit: 1 })], null);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.error).toBe("free_sample_used");
    expect(out.error.used).toBe(1);
    expect(out.error.limit).toBe(1);
  });

  it("refuses a premium user at the monthly limit", () => {
    const out = mapReservation([row({ allowed: false, used: 50, quota_limit: 50 })], null);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.error).toBe("monthly_limit_reached");
    expect(out.error.message).toContain("50/50");
  });

  it("accepts bigint counts serialised as strings", () => {
    const out = mapReservation([row({ allowed: true, used: "12", quota_limit: "50" })], null);
    expect(out).toMatchObject({ ok: true, used: 12, limit: 50, isPremium: true });
  });

  it("treats an RPC error as an AI failure, not as a quota refusal", () => {
    const out = mapReservation(null, new Error("boom"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.error).toBe("ai_failed");
  });

  it("treats an empty result set as an AI failure", () => {
    const out = mapReservation([], null);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.error).toBe("ai_failed");
  });

  it("accepts a single-object result (non-array RPC shape)", () => {
    const out = mapReservation(row({ allowed: true, used: 1, quota_limit: 1 }), null);
    expect(out.ok).toBe(true);
  });
});
