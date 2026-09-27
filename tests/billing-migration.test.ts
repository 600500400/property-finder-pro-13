import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const uid = "10000000-0000-4000-8000-000000000001";
const db = new PGlite();
async function claim() {
  const result = await db.query<{ result: { token: string } }>(
    "select public.acquire_billing_operation($1) as result",
    [uid],
  );
  return result.rows[0].result.token;
}
const snapshot = {
  id: "sub_1",
  customer: "cus_1",
  plan: "premium_monthly",
  status: "active",
  current_period_end: "2027-01-01T00:00:00Z",
  cancel_at_period_end: false,
};
const apply = (token: string, event = "evt_1", value = snapshot) =>
  db.query<{ applied: boolean }>(
    "select public.apply_stripe_subscription($1,$2,$3,$4) as applied",
    [uid, token, event, value],
  );

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    insert into auth.users values ('${uid}');`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260612104601_6f6d3581-46f5-4813-957e-618d3662ad9b.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync("supabase/migrations/20260927090000_billing_safety.sql", "utf8"));
});
beforeEach(() =>
  db.exec(
    "truncate public.billing_operations, public.stripe_processed_events, public.subscriptions",
  ),
);
afterAll(() => db.close());

describe("billing migration on isolated PostgreSQL (PGlite)", () => {
  it("allows only one outstanding operation per user", async () => {
    await claim();
    await expect(claim()).rejects.toThrow("in progress");
  });
  it("release permits a new token", async () => {
    const token = await claim();
    await db.query("select public.release_billing_operation($1,$2)", [uid, token]);
    expect(await claim()).not.toBe(token);
  });
  it("expired workers cannot write or release the replacement lock", async () => {
    const old = await claim();
    await db.exec("update public.billing_operations set lock_until = now() - interval '1 second'");
    const current = await claim();
    await expect(apply(old)).rejects.toThrow("expired");
    await expect(
      db.query("select public.save_billing_attempt($1,$2,$3)", [uid, old, {}]),
    ).rejects.toThrow("expired");
    await db.query("select public.release_billing_operation($1,$2)", [uid, old]);
    await expect(claim()).rejects.toThrow("in progress");
    expect((await apply(current)).rows[0].applied).toBe(true);
  });
  it("applies an event exactly once", async () => {
    const token = await claim();
    expect((await apply(token)).rows[0].applied).toBe(true);
    expect((await apply(token, "evt_1", { ...snapshot, status: "canceled" })).rows[0].applied).toBe(
      false,
    );
    expect(
      (await db.query<{ status: string }>("select status from public.subscriptions")).rows[0]
        .status,
    ).toBe("active");
  });
  it("rolls back the event receipt when a subscription write fails; retry succeeds", async () => {
    const token = await claim();
    await expect(apply(token, "evt_retry", { ...snapshot, plan: "invalid" })).rejects.toThrow();
    expect((await db.query("select * from public.stripe_processed_events")).rows).toHaveLength(0);
    expect((await apply(token, "evt_retry")).rows[0].applied).toBe(true);
  });
  it("does not cancel a replacement subscription", async () => {
    const token = await claim();
    await apply(token);
    await apply(token, "evt_old_delete", { ...snapshot, id: "sub_old", status: "canceled" });
    expect(
      (await db.query<{ status: string }>("select status from public.subscriptions")).rows[0]
        .status,
    ).toBe("active");
  });
  it("cancels the matching subscription", async () => {
    const token = await claim();
    await apply(token);
    await apply(token, "evt_delete", { ...snapshot, status: "canceled" });
    expect(
      (await db.query<{ plan: string }>("select plan from public.subscriptions")).rows[0].plan,
    ).toBe("free");
  });
  it.each(["anon", "authenticated"])("denies billing operations to %s", async (role) => {
    await db.exec("set role " + role);
    try {
      await expect(claim()).rejects.toThrow("permission denied");
      await expect(db.query("select * from public.billing_operations")).rejects.toThrow(
        "permission denied",
      );
      await expect(db.query("select * from public.stripe_processed_events")).rejects.toThrow(
        "permission denied",
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("allows service role to acquire and release", async () => {
    await db.exec("set role service_role");
    try {
      const token = await claim();
      await db.query("select public.release_billing_operation($1,$2)", [uid, token]);
    } finally {
      await db.exec("reset role");
    }
  });
});
