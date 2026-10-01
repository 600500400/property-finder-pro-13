import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  save: vi.fn(),
  customerCreate: vi.fn(),
  customerUpdate: vi.fn(),
  customerRetrieve: vi.fn(),
  list: vi.fn(),
  retrieve: vi.fn(),
  sessionCreate: vi.fn(),
  sessionList: vi.fn(),
  sessionRetrieve: vi.fn(),
  expire: vi.fn(),
  portal: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }),
      upsert: mocks.upsert,
    }),
    rpc: mocks.rpc,
  },
}));
vi.mock("@/lib/billing/operations.server", () => ({
  acquireBilling: mocks.acquire,
  releaseBilling: mocks.release,
  saveAttempt: mocks.save,
}));
vi.mock("@/lib/billing/stripe.server", () => ({
  getStripe: () => ({
    customers: {
      create: mocks.customerCreate,
      update: mocks.customerUpdate,
      retrieve: mocks.customerRetrieve,
    },
    subscriptions: { list: mocks.list, retrieve: mocks.retrieve },
    checkout: {
      sessions: {
        create: mocks.sessionCreate,
        list: mocks.sessionList,
        retrieve: mocks.sessionRetrieve,
        expire: mocks.expire,
      },
    },
    billingPortal: { sessions: { create: mocks.portal } },
    webhooks: { constructEventAsync: mocks.construct },
  }),
  PLAN_PRICES: {
    premium_monthly: { amount: 34900, interval: "month", label: "Premium měsíčně" },
    premium_yearly: { amount: 349000, interval: "year", label: "Premium ročně" },
  },
}));
import { startCheckout } from "@/lib/billing/checkout.server";
import { handleStripeWebhook, processStripeEvent } from "@/lib/billing/webhook.server";

const sub = {
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  created: 100,
  metadata: { user_id: "user", plan: "premium_monthly" },
  items: {
    data: [{ current_period_end: 1900000000, price: { recurring: { interval: "month" } } }],
  },
  cancel_at_period_end: false,
};
const event = {
  id: "evt_1",
  type: "customer.subscription.updated",
  data: { object: sub },
} as unknown as Stripe.Event;
const request = () =>
  new Request("https://www.realityscanner.cz/api/public/stripe/webhook", {
    method: "POST",
    body: "raw-event",
    headers: { "stripe-signature": "signed" },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test-only");
  mocks.read.mockResolvedValue({
    data: { user_id: "user", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" },
    error: null,
  });
  mocks.acquire.mockResolvedValue({ token: "token", attempt: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.list.mockImplementation(async function* () {});
  mocks.sessionList.mockImplementation(async function* () {});
  mocks.retrieve.mockResolvedValue(sub);
  mocks.construct.mockResolvedValue(event);
  mocks.sessionCreate.mockResolvedValue({
    id: "cs_1",
    url: "https://checkout.stripe.com/test",
    status: "open",
  });
  mocks.customerRetrieve.mockResolvedValue({ id: "cus_1", deleted: false });
  mocks.customerCreate.mockResolvedValue({ id: "cus_new" });
  mocks.portal.mockResolvedValue({ url: "https://billing.stripe.com/test" });
});

describe("checkout with mocked Stripe, no payments", () => {
  it("recovers a checkout opened before this migration", async () => {
    mocks.sessionList.mockImplementation(async function* () {
      yield {
        id: "cs_legacy",
        mode: "subscription",
        created: 100,
        metadata: { user_id: "user", plan: "premium_monthly" },
      };
    });
    mocks.sessionRetrieve.mockResolvedValue({
      id: "cs_legacy",
      status: "open",
      url: "https://checkout.stripe.com/legacy",
    });
    expect(await startCheckout("user", undefined, "premium_monthly")).toEqual({
      url: "https://checkout.stripe.com/legacy",
    });
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("blocks a completed checkout awaiting activation", async () => {
    mocks.acquire.mockResolvedValue({
      token: "t",
      attempt: { id: "a", sessionId: "cs_done", plan: "premium_monthly" },
    });
    mocks.sessionRetrieve.mockResolvedValue({
      id: "cs_done",
      status: "complete",
      subscription: "sub_1",
    });
    await expect(startCheckout("user", undefined, "premium_monthly")).rejects.toThrow("dokončena");
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("recreates customer if existing customerId does not exist in provider (e.g. sandbox to live)", async () => {
    mocks.customerRetrieve.mockRejectedValue(new Error("No such customer: 'cus_sandbox'"));
    await startCheckout("user", undefined, "premium_monthly");
    expect(mocks.customerCreate).toHaveBeenCalledWith(
      { metadata: { user_id: "user" } },
      { idempotencyKey: "rs-customer-user" },
    );
  });
  it("permits repurchase after the old subscription has actually ended", async () => {
    mocks.acquire.mockResolvedValue({
      token: "t",
      attempt: { id: "a", sessionId: "cs_done", plan: "premium_monthly" },
    });
    mocks.sessionRetrieve.mockResolvedValue({
      id: "cs_done",
      status: "complete",
      subscription: "sub_1",
    });
    mocks.retrieve.mockResolvedValue({ ...sub, status: "canceled" });
    await startCheckout("user", undefined, "premium_monthly");
    expect(mocks.sessionCreate).toHaveBeenCalledTimes(1);
  });
  it("persists an attempt before creating a session and uses its idempotency key", async () => {
    await startCheckout("user", undefined, "premium_monthly");
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sessionCreate.mock.invocationCallOrder[0],
    );
    const attempt = mocks.save.mock.calls[0][2];
    expect(mocks.sessionCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: "rs-checkout-" + attempt.id,
    });
    expect(mocks.sessionCreate.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(34900);
  });
  it.each(["active", "trialing", "past_due", "incomplete", "unpaid"])(
    "does not create a second subscription for %s",
    async (status) => {
      mocks.list.mockImplementation(async function* () {
        yield { status };
      });
      expect(await startCheckout("user", undefined, "premium_yearly")).toEqual({
        url: "https://billing.stripe.com/test",
      });
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
    },
  );
  it("fails closed on a database read error", async () => {
    mocks.read.mockResolvedValue({ error: { message: "db offline" } });
    await expect(startCheckout("user", undefined, "premium_monthly")).rejects.toThrow();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("fails closed if the attempt cannot be saved", async () => {
    mocks.save.mockRejectedValue(new Error("db offline"));
    await expect(startCheckout("user", undefined, "premium_monthly")).rejects.toThrow();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("two concurrent requests cannot both create sessions", async () => {
    let held = false;
    mocks.acquire.mockImplementation(async () => {
      if (held) throw new Error("busy");
      held = true;
      return { token: "token", attempt: null };
    });
    const results = await Promise.allSettled([
      startCheckout("user", undefined, "premium_monthly"),
      startCheckout("user", undefined, "premium_yearly"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(mocks.sessionCreate).toHaveBeenCalledTimes(1);
  });
  it("reuses the persisted idempotency key after an uncertain provider response", async () => {
    mocks.acquire.mockResolvedValue({
      token: "t",
      attempt: {
        id: "attempt_1",
        created: Date.now(),
        origin: "https://www.realityscanner.cz",
        plan: "premium_monthly",
      },
    });
    await startCheckout("user", undefined, "premium_monthly");
    expect(mocks.sessionCreate.mock.calls[0][1].idempotencyKey).toBe("rs-checkout-attempt_1");
    expect(mocks.sessionCreate).toHaveBeenCalledTimes(1);
  });
  it("does not retry an unresolved attempt outside Stripe idempotency retention", async () => {
    mocks.acquire.mockResolvedValue({
      token: "t",
      attempt: {
        id: "old",
        created: 0,
        plan: "premium_monthly",
        origin: "https://www.realityscanner.cz",
      },
    });
    await expect(startCheckout("user", undefined, "premium_monthly")).rejects.toThrow("ověřit");
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
  it("expires the previous checkout before changing plans", async () => {
    mocks.acquire.mockResolvedValue({
      token: "t",
      attempt: { id: "a", sessionId: "cs_old", plan: "premium_monthly" },
    });
    mocks.sessionRetrieve.mockResolvedValue({ id: "cs_old", status: "open" });
    await startCheckout("user", undefined, "premium_yearly");
    expect(mocks.expire.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sessionCreate.mock.invocationCallOrder[0],
    );
  });
});
describe("webhook", () => {
  it("returns 400 without a signature", async () => {
    expect(
      (await handleStripeWebhook(new Request("https://test", { method: "POST" }))).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures", async () => {
    mocks.construct.mockRejectedValue(new Error("invalid"));
    expect((await handleStripeWebhook(request())).status).toBe(400);
  });
  it("returns 500 on a DB write error, so Stripe retries", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
    expect((await handleStripeWebhook(request())).status).toBe(500);
  });
  it("returns 500 on lookup failure", async () => {
    mocks.read.mockResolvedValue({ error: { message: "offline" } });
    expect((await handleStripeWebhook(request())).status).toBe(500);
  });
  it("accepts duplicate event acknowledgement from the atomic DB function", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await handleStripeWebhook(request())).status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1]._event_id).toBe("evt_1");
  });
  it("uses fresh state, not the active state in an old event", async () => {
    mocks.retrieve.mockResolvedValueOnce(sub).mockResolvedValueOnce({ ...sub, status: "canceled" });
    await processStripeEvent(event);
    expect(mocks.rpc.mock.calls[0][1]._snapshot.status).toBe("canceled");
  });
  it("does not apply an older subscription over its replacement", async () => {
    mocks.read
      .mockResolvedValueOnce({ data: { user_id: "user" } })
      .mockResolvedValueOnce({ data: { stripe_subscription_id: "sub_new" } });
    mocks.retrieve
      .mockResolvedValueOnce(sub)
      .mockResolvedValueOnce(sub)
      .mockResolvedValueOnce({ ...sub, id: "sub_new", created: 200 });
    await processStripeEvent(event);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("old subscription cancellation cannot revoke the new subscription", async () => {
    mocks.read
      .mockResolvedValueOnce({ data: { user_id: "user" } })
      .mockResolvedValueOnce({ data: { stripe_subscription_id: "sub_new" } });
    mocks.retrieve.mockResolvedValue({ ...sub, status: "canceled" });
    await processStripeEvent(event);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails rather than granting indefinite Premium with no period", async () => {
    mocks.retrieve.mockResolvedValue({ ...sub, items: { data: [] } });
    await expect(processStripeEvent(event)).rejects.toThrow("period");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
