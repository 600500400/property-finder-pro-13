import { readCookieConsent } from "./cookie-consent";
import type { ConversionEvent } from "./conversion-events";

export const GA_MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || "G-HL1FMNLRC9";
export const GA_SCRIPT_ID = "realityscanner-ga4";
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};
const allowedConversions = new Set<ConversionEvent>([
  "organic_landing",
  "signup_completed",
  "signup_confirmation_required",
  "checkout_started",
  "premium_confirmed",
]);
let lastPage: string | null = null;

/** Basic consent mode: no Google script, request or pre-consent event queue. */
export function startAnalytics(): boolean {
  if (!readCookieConsent()?.analytics || !/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) return false;
  const target = window as unknown as AnalyticsWindow;
  target[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (document.getElementById(GA_SCRIPT_ID)) return true;
  target.dataLayer = [];
  // Google gtag queues Arguments objects, not a network call.

  target.gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- gtag's documented queue contract
    target.dataLayer!.push(arguments);
  };
  target.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  target.gtag("consent", "update", { analytics_storage: "granted" });
  target.gtag("js", new Date());
  target.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 180 * 24 * 60 * 60,
    cookie_update: false,
    page_location: safePageLocation(),
    page_referrer: safeReferrer(),
  });
  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  try {
    if (
      /(^|\.)(google\.[a-z.]+|bing\.com|search\.seznam\.cz)$/.test(
        new URL(document.referrer).hostname,
      )
    ) {
      trackConversion("organic_landing");
    }
  } catch {
    /* no referrer */
  }
  return true;
}

/** Keep campaign attribution but strip auth tokens, emails and arbitrary queries. */
export function safePageLocation(): string {
  const url = new URL(window.location.href);
  const safe = new URL(url.origin + url.pathname);
  for (const name of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = url.searchParams.get(name);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) safe.searchParams.set(name, value);
  }
  return safe.href;
}
function safeReferrer(): string {
  try {
    return new URL(document.referrer).origin;
  } catch {
    return "";
  }
}
export function trackPageView(): void {
  if (!readCookieConsent()?.analytics || !document.getElementById(GA_SCRIPT_ID)) return;
  const page = safePageLocation();
  if (page === lastPage) return;
  lastPage = page;
  (window as unknown as AnalyticsWindow).gtag?.("event", "page_view", {
    page_location: page,
    page_path: window.location.pathname,
    page_referrer: safeReferrer(),
  });
}
export function trackConversion(event: string): void {
  if (
    !allowedConversions.has(event as ConversionEvent) ||
    !readCookieConsent()?.analytics ||
    !document.getElementById(GA_SCRIPT_ID)
  )
    return;
  (window as unknown as AnalyticsWindow).gtag?.("event", event, {
    page_location: safePageLocation(),
    page_referrer: safeReferrer(),
  });
}

/** Delete only GA cookies; leave the user's login and saved preferences intact. */
export function stopAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  const target = window as unknown as AnalyticsWindow;
  target[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  const loaded = !!document.getElementById(GA_SCRIPT_ID);
  document.getElementById(GA_SCRIPT_ID)?.remove();
  target.dataLayer = [];
  lastPage = null;
  const host = window.location.hostname;
  const labels = host.split(".");
  const domains = ["", ...labels.slice(0, -1).map((_, index) => labels.slice(index).join("."))];
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (!/^(_ga($|_)|_gid$|_gat($|_))/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
  return loaded;
}
