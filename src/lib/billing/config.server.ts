import { SITE_URL } from "@/lib/site";

export function billingMode(key = process.env.STRIPE_SECRET_KEY): "test" | "live" | "unavailable" {
  if (/^(sk|rk)_test_/.test(key ?? "")) return "test";
  if (/^(sk|rk)_live_/.test(key ?? "")) return "live";
  return "unavailable";
}

export function billingOrigin(value = process.env.PUBLIC_APP_URL): string {
  const url = new URL(value || SITE_URL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("PUBLIC_APP_URL musí být HTTPS adresa aplikace bez cesty.");
  }
  return url.origin; // Configuration only; never trust request Host or return URLs.
}
