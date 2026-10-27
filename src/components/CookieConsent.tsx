import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";
import { startAnalytics, stopAnalytics, trackConversion, trackPageView } from "@/lib/analytics";

export function CookieConsent() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const sync = () => {
      const choice = readCookieConsent();
      setEnabled(choice?.analytics ?? false);
      if (!choice) setOpen(true);
      if (choice?.analytics && startAnalytics()) trackPageView();
      else if (stopAnalytics()) {
        // Unload Google's already-running code after withdrawal/expiry, including
        // enhanced measurement listeners. Stored auth and filters are preserved.
        window.location.reload();
      }
    };
    const conversion = (event: Event) =>
      trackConversion((event as CustomEvent<{ event: string }>).detail?.event);
    const storage = (event: StorageEvent) => {
      if (!event.key || event.key === CONSENT_KEY) sync();
    };
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", sync);
    window.addEventListener("realityscanner:conversion", conversion);
    const unsubscribe = router.subscribe("onResolved", () => {
      sync();
      trackPageView();
    });
    const timer = window.setInterval(sync, 60_000);
    sync();
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", sync);
      window.removeEventListener("realityscanner:conversion", conversion);
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [router]);
  const choose = (analytics: boolean) => {
    if (!saveCookieConsent(analytics)) {
      stopAnalytics();
      setError(true);
      return;
    }
    setError(false);
    setOpen(false);
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-40 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-md"
      >
        Nastavení cookies
      </button>
    );
  return (
    <section
      aria-labelledby="cookie-heading"
      className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl"
    >
      <div className="mx-auto max-w-4xl">
        <h2 id="cookie-heading" className="text-base font-semibold">
          Vaše soukromí a cookies
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nezbytné úložiště zajišťuje přihlášení a Vaše nastavení. S Vaším souhlasem používáme
          Google Analytics k měření návštěvnosti a používání webu. Analytiku můžete odmítnout a
          službu dál používat.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Analytika: {enabled ? "povolena" : "vypnuta"}. Volbu si pamatujeme 180 dní. Změníte ji
          přes „Nastavení cookies“.
        </p>
        <Link
          to="/ochrana-osobnich-udaju"
          hash="cookies"
          className="mt-2 inline-block text-sm text-primary underline"
        >
          Podrobnosti o cookies
        </Link>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-lg border border-primary bg-primary/10 px-4 py-3 text-sm font-semibold"
          >
            Odmítnout analytické
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-lg border border-primary bg-primary/10 px-4 py-3 text-sm font-semibold"
          >
            Povolit analytické
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-amber-400">
            Volbu se nepodařilo uložit. Analytika zůstává vypnutá. Zkontrolujte nastavení úložiště
            prohlížeče.
          </p>
        )}
      </div>
    </section>
  );
}
