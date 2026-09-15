import { describe, it, expect, beforeEach, vi } from "vitest";

const adminFrom = vi.fn();
const executeScan = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: adminFrom },
}));
vi.mock("@/lib/scanner/scan-internal.server", () => ({ executeScan }));

import { verifyCronSecret } from "@/lib/scanner/cron-auth.server";
import { Route } from "@/routes/api/public/hooks/run-schedules";

const SECRET = "test-cron-secret-value";

function post(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/public/hooks/run-schedules", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: "{}",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (Route as any).options.server.handlers.POST as (ctx: {
  request: Request;
}) => Promise<Response>;

describe("verifyCronSecret", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  it("rejects a missing Authorization header", () => {
    expect(verifyCronSecret(post())).toBe(false);
  });

  it("rejects a wrong bearer token", () => {
    expect(verifyCronSecret(post({ authorization: `Bearer nope` }))).toBe(false);
  });

  it("rejects the publishable apikey header", () => {
    expect(verifyCronSecret(post({ apikey: SECRET }))).toBe(false);
  });

  it("accepts the correct bearer token", () => {
    expect(verifyCronSecret(post({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it("rejects everything when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret(post({ authorization: `Bearer ${SECRET}` }))).toBe(false);
  });
});

describe("POST /api/public/hooks/run-schedules", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    adminFrom.mockReset();
    executeScan.mockReset();
  });

  it("returns 401 and touches nothing without a header", async () => {
    const res = await handler({ request: post() });
    expect(res.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("returns 401 and touches nothing with a wrong token", async () => {
    const res = await handler({ request: post({ authorization: "Bearer wrong" }) });
    expect(res.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("proceeds past auth with the correct token (no schedules due)", async () => {
    adminFrom.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });
    const res = await handler({ request: post({ authorization: `Bearer ${SECRET}` }) });
    expect(res.status).toBe(200);
    expect(adminFrom).toHaveBeenCalledWith("scheduled_scans");
    expect(executeScan).not.toHaveBeenCalled();
  });
});
