// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_KEY,
  CONSENT_LIFETIME_MS,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";
import {
  GA_MEASUREMENT_ID,
  GA_SCRIPT_ID,
  safePageLocation,
  startAnalytics,
  stopAnalytics,
  trackConversion,
  trackPageView,
} from "@/lib/analytics";

function queue(): unknown[][] {
  return ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((item) =>
    Array.from(item),
  );
}
beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = "";
  window.history.replaceState({}, "", "/");
  stopAnalytics();
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    if (node instanceof HTMLScriptElement) node.type = "text/plain";
    return append(node);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("analytics consent boundary", () => {
  it("loads no Google tag or queued events before consent or after rejection", () => {
    expect(startAnalytics()).toBe(false);
    trackPageView();
    trackConversion("signup_completed");
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(queue()).toEqual([]);
    saveCookieConsent(false);
    expect(startAnalytics()).toBe(false);
    trackConversion("checkout_started");
    expect(queue()).toEqual([]);
  });
  it("rejects malformed, future, old-version and expired choices", () => {
    for (const value of [
      "{broken",
      JSON.stringify({ version: 0, analytics: true, updatedAt: Date.now() }),
      JSON.stringify({ version: 1, analytics: "true", updatedAt: Date.now() }),
      JSON.stringify({ version: 1, analytics: true, updatedAt: Date.now() + 10000 }),
      JSON.stringify({ version: 1, analytics: true, updatedAt: Date.now() - CONSENT_LIFETIME_MS }),
    ]) {
      localStorage.setItem(CONSENT_KEY, value);
      expect(readCookieConsent()).toBeNull();
      expect(startAnalytics()).toBe(false);
    }
  });
  it("loads one tag after opt-in, keeps ads denied, and tracks each route once", () => {
    saveCookieConsent(true);
    expect(startAnalytics()).toBe(true);
    startAnalytics();
    expect(document.querySelectorAll(`#${GA_SCRIPT_ID}`)).toHaveLength(1);
    expect(queue()[0]).toEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(queue()[1]).toEqual(["consent", "update", { analytics_storage: "granted" }]);
    trackPageView();
    trackPageView();
    window.history.pushState({}, "", "/cenik");
    trackPageView();
    expect(queue().filter((call) => call[0] === "event" && call[1] === "page_view")).toHaveLength(
      2,
    );
  });
  it("does not send auth tokens or arbitrary URL queries and retains safe UTMs", () => {
    window.history.replaceState(
      {},
      "",
      "/auth?token_hash=secret&email=private%40example.com&utm_source=facebook&utm_campaign=first5&utm_content=private%40example.com#access_token=secret",
    );
    expect(safePageLocation()).toBe(
      window.location.origin + "/auth?utm_source=facebook&utm_campaign=first5",
    );
    saveCookieConsent(true);
    startAnalytics();
    trackPageView();
    trackConversion("signup_completed");
    expect(JSON.stringify(queue())).not.toMatch(/token_hash|private|access_token/);
    expect(JSON.stringify(queue())).toContain("utm_source=facebook");
    const before = queue().length;
    trackConversion("unrecognized_event");
    expect(queue()).toHaveLength(before);
  });
  it("withdrawal stops later events and removes GA cookies without affecting auth", () => {
    saveCookieConsent(true);
    startAnalytics();
    document.cookie = "_ga=analytics; path=/";
    document.cookie = "_ga_TEST=analytics; path=/";
    document.cookie = "session=keep; path=/";
    localStorage.setItem("sb-example-auth-token", "keep");
    saveCookieConsent(false);
    expect(stopAnalytics()).toBe(true);
    trackPageView();
    trackConversion("premium_confirmed");
    expect(document.getElementById(GA_SCRIPT_ID)).toBeNull();
    expect(queue()).toEqual([]);
    expect(document.cookie).not.toContain("_ga");
    expect(document.cookie).toContain("session=keep");
    expect(localStorage.getItem("sb-example-auth-token")).toBe("keep");
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(
      true,
    );
  });
  it("checks expiry before sending a conversion even while a page is open", () => {
    vi.useFakeTimers();
    saveCookieConsent(true);
    startAnalytics();
    const before = queue().length;
    vi.setSystemTime(Date.now() + CONSENT_LIFETIME_MS);
    trackConversion("signup_completed");
    trackPageView();
    expect(queue()).toHaveLength(before);
  });
  it("fails closed when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readCookieConsent()).toBeNull();
    expect(startAnalytics()).toBe(false);
  });
});
