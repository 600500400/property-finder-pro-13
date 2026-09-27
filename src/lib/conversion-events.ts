/** Integration hooks only: no cookies, storage, analytics SDK or network requests.
 * A consent-aware analytics adapter may subscribe to this DOM event.
 * Do not treat client events as authoritative revenue records.
 */
export type ConversionEvent =
  | "organic_landing"
  | "signup_completed"
  | "signup_confirmation_required"
  | "checkout_started"
  | "premium_confirmed";
export function emitConversion(event: ConversionEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("realityscanner:conversion", { detail: { event } }));
}
