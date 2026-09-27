import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { safeReturnPath, signupConfirmationUrl } from "@/lib/auth-return";
import { publicPageHead, OPERATOR, SITE_URL } from "@/lib/site";
import { calculateRentalScenario } from "@/lib/rental-calculator";
import { billingMode, billingOrigin } from "@/lib/billing/config.server";
import { listingActionId, listingReturnPath } from "@/lib/listing-return";

describe("safe login return", () => {
  it("preserves the listing fragment across email confirmation without colliding with auth tokens", () => {
    const url = new URL(
      signupConfirmationUrl("https://www.realityscanner.cz", "/?region=Praha#ai-listing"),
    );
    expect(url.pathname).toBe("/auth");
    expect(url.hash).toBe("");
    expect(url.searchParams.get("next")).toBe("/?region=Praha#ai-listing");
    expect(url.searchParams.get("confirmed")).toBe("1");
  });
  it("does not embed an external email-confirmation return", () => {
    const url = new URL(
      signupConfirmationUrl("https://www.realityscanner.cz", "https://evil.test"),
    );
    expect(url.searchParams.get("next")).toBe("/");
  });
  it.each([
    "/cenik?billing=monthly",
    "/cenik?billing=yearly",
    "/?region=Praha#ai-123",
    "/?city=Benešov%20nad%20Ploučnicí",
    "/bookmarks",
  ])("preserves local intent %s", (value) => {
    expect(safeReturnPath(value)).toBe(value);
  });
  it("returns to the selected listing action without automatic AI consumption", () => {
    const listing = { id: "listing-123", url: "https://example.test" };
    const path = listingReturnPath("ai", listing, { pathname: "/", search: "?region=Praha" });
    expect(path).toBe("/?region=Praha#" + listingActionId("ai", listing));
    expect(safeReturnPath(path)).toBe(path);
  });
  it.each(["/x/../auth?next=evil", "/%25252f%25252fevil.test", "/%2525250aevil.test"])(
    "rejects normalized redirect %s",
    (value) => {
      expect(safeReturnPath(value)).toBe("/");
    },
  );
  it.each([
    undefined,
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%5cevil.test",
    "/%250aevil.test",
    "javascript:alert(1)",
    " /cenik",
    "/auth?next=//evil",
    "/%zz",
  ])("rejects %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});
describe("public pages and operator", () => {
  it("has one canonical per page, none inherited from root", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).not.toContain('rel: "canonical"');
    expect(publicPageHead("/kontakt", "Kontakt", "Popis").links).toEqual([
      { rel: "canonical", href: SITE_URL + "/kontakt" },
    ]);
  });
  it("uses verified operator details and no unapproved refund guarantee", () => {
    expect(OPERATOR.ico).toBe("88549836");
    expect(OPERATOR.email).toBe("kamelpost@gmail.com");
    const pricing = readFileSync("src/routes/cenik.tsx", "utf8");
    expect(pricing).not.toContain("500+");
    expect(pricing).not.toContain("14 dní garance");
    for (const name of ["obchodni-podminky", "ochrana-osobnich-udaju"]) {
      expect(readFileSync("src/routes/" + name + ".tsx", "utf8")).not.toContain("DOPLNIT");
    }
  });
  it("makes the four new public pages eligible for sitemap", () => {
    for (const name of [
      "kontakt",
      "investicni-nemovitosti",
      "kalkulacka-vynosu",
      "jak-poznat-predrazeny-byt",
    ]) {
      expect(readFileSync("src/routes/" + name + ".tsx", "utf8")).toContain("sitemap: true");
    }
  });
});
describe("rental scenario (does not change scanner assumptions)", () => {
  it("computes gross and net with separate costs and vacancy", () => {
    expect(calculateRentalScenario(4500000, 15000, 2250, 5)).toEqual({
      annualGross: 180000,
      annualNet: 144000,
      grossYield: 4,
      netYield: 3.2,
    });
  });
  it("allows negative net yield and 100% vacancy", () => {
    expect(calculateRentalScenario(1000000, 10000, 1000, 100)?.netYield).toBe(-1.2);
  });
  it.each([
    [0, 1, 1, 0],
    [1, 1, 1, 0],
    [NaN, 1, 1, 0],
    [100, -1, 0, 0],
    [100, 1, -1, 0],
    [100, 1, 0, 101],
    [Infinity, 1, 0, 0],
  ])("rejects invalid inputs %s", (...args) => {
    expect(calculateRentalScenario(...(args as [number, number, number, number]))).toBeNull();
  });
});
describe("billing configuration", () => {
  it("returns only a safe environment label", () => {
    expect(billingMode("sk_test_example")).toBe("test");
    expect(billingMode("rk_live_example")).toBe("live");
    expect(billingMode("bad")).toBe("unavailable");
  });
  it("defaults to production and rejects malformed origins", () => {
    expect(billingOrigin("")).toBe(SITE_URL);
    for (const origin of [
      "http://evil.test",
      "https://user:pass@test.cz",
      "https://test.cz/path",
      "https://test.cz?next=x",
    ]) {
      expect(() => billingOrigin(origin)).toThrow();
    }
  });
});
