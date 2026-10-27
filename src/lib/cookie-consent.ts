export const CONSENT_KEY = "realityscanner.cookie-consent.v1";
export const CONSENT_EVENT = "realityscanner:consent";
export const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;

export interface CookieConsent {
  version: 1;
  analytics: boolean;
  updatedAt: number;
}
let storageFailed = false;

/** Invalid, unavailable or expired storage never grants permission. */
export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined" || storageFailed) return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? "null");
    const now = Date.now();
    return value?.version === 1 &&
      typeof value.analytics === "boolean" &&
      Number.isFinite(value.updatedAt) &&
      value.updatedAt <= now &&
      now - value.updatedAt < CONSENT_LIFETIME_MS
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(analytics: boolean): boolean {
  try {
    const value: CookieConsent = { version: 1, analytics, updatedAt: Date.now() };
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
    storageFailed = false;
    window.dispatchEvent(new Event(CONSENT_EVENT));
    return true;
  } catch {
    storageFailed = true;
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* remain denied */
    }
    return false;
  }
}
