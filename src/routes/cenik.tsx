import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { emitConversion } from "@/lib/conversion-events";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2, ArrowLeft } from "lucide-react";
import { createCheckoutSession, createPortalSession, getBillingEnvironment } from "@/lib/billing/checkout.functions";
import { useQuery } from "@tanstack/react-query";
import { OPERATOR } from "@/lib/site";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/cenik")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): { billing?: "monthly" | "yearly"; checkout?: "success" | "cancel" } => ({
    billing: search.billing === "monthly" || search.billing === "yearly" ? search.billing : undefined,
    checkout: search.checkout === "success" || search.checkout === "cancel" ? search.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ceník předplatného | RealityScanner" },
      { name: "description", content: "Vyzkoušejte RealityScanner zdarma nebo získejte Premium za 349 Kč měsíčně. Inzeráty v reálném čase, neomezení hlídací psi, AI analýzy a exporty do Excelu." },
      { property: "og:title", content: "Ceník RealityScanner — Free a Premium za 349 Kč" },
      { property: "og:description", content: "Vyzkoušejte RealityScanner zdarma nebo získejte Premium za 349 Kč měsíčně. Inzeráty v reálném čase, neomezení hlídací psi a XLS export." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.realityscanner.cz/cenik" },
      { name: "twitter:title", content: "Ceník RealityScanner — Free a Premium za 349 Kč" },
      { name: "twitter:description", content: "Vyzkoušejte RealityScanner zdarma nebo získejte Premium za 349 Kč měsíčně." },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.realityscanner.cz/cenik" }],
  }),
  component: Pricing,
});

function Pricing() {
  const search = Route.useSearch();
  const { data: plan, refetch } = usePlan();
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createPortalSession);
  const environment = useServerFn(getBillingEnvironment);
  const { data: paymentEnvironment, isError: billingEnvironmentError } = useQuery({ queryKey: ["billing-environment"], queryFn: () => environment() });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">(search.billing ?? "yearly");
  const [verificationEnded, setVerificationEnded] = useState(false);
  const premiumReported = useRef(false);
  useEffect(() => {
    if (search.checkout === "success" && plan?.is_premium && !premiumReported.current) {
      premiumReported.current = true;
      emitConversion("premium_confirmed");
    }
  }, [search.checkout, plan?.is_premium]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (search.checkout === "success" && authed && !plan?.is_premium) {
      setVerificationEnded(false);
      let n = 0;
      const t = setInterval(() => {
        void refetch();
        if (++n >= 10) { clearInterval(t); setVerificationEnded(true); }
      }, 1500);
      return () => clearInterval(t);
    }
  }, [refetch, search.checkout, authed, plan?.is_premium]);

  const goCheckout = async (planKey: "premium_monthly" | "premium_yearly") => {
    if (!authed) { window.location.href = "/auth?next=" + encodeURIComponent("/cenik?billing=" + (planKey === "premium_yearly" ? "yearly" : "monthly")); return; }
    setBusy(planKey); setErr(null);
    try {
      const { url } = await checkout({ data: { plan: planKey } });
      if (url) {
        // Existing subscribers may be returned to the billing portal instead.
        if (new URL(url).hostname === "checkout.stripe.com") emitConversion("checkout_started");
        window.location.href = url;
      }
      else throw new Error("Platební stránka není dostupná. Zkuste to prosím znovu.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const goPortal = async () => {
    setBusy("portal"); setErr(null);
    try {
      const { url } = await portal();
      if (url) window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zpět na skener
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-center text-3xl font-bold tracking-tight md:text-4xl">Ceník</h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Free na vyzkoušení, Premium pro investory, kteří nesmí přijít o nový inzerát.
        </p>

        {paymentEnvironment?.mode === "test" && <p role="status" className="mx-auto mt-5 max-w-xl rounded-lg border border-amber-500/40 p-3 text-center text-sm text-amber-500">Testovací režim plateb (Stripe sandbox). Nejde o skutečnou platbu.</p>}
        {(paymentEnvironment?.mode === "unavailable" || billingEnvironmentError) && <p role="status" className="mt-5 text-center text-sm">Platby nyní nejsou dostupné. Skener zdarma můžete používat dál.</p>}
        {search.checkout === "cancel" && <p role="status" className="mt-5 text-center text-sm">Vrátili jste se z platby. Stav případného předplatného ověřujeme v účtu.</p>}
        {search.checkout === "success" && !plan?.is_premium && <div role="status" className="mx-auto mt-5 max-w-xl rounded-lg border border-border p-4 text-center text-sm">
          {!authed ? <>Pro ověření Premium se <Link to="/auth" search={{ next: "/cenik?checkout=success" }} className="text-primary underline">přihlaste ke stejnému účtu</Link>.</>
            : verificationEnded ? <>Aktivace zatím není potvrzená. Neplaťte znovu. <button className="text-primary underline" onClick={() => void refetch()}>Ověřit znovu</button> nebo <a className="text-primary underline" href={`mailto:${OPERATOR.email}`}>kontaktujte podporu</a>.</>
            : <>Ověřujeme aktivaci Premium. Může to chvíli trvat…</>}
        </div>}

        {plan?.is_premium && (
          <div className="mx-auto mt-6 max-w-md rounded-lg border border-primary/40 bg-primary/10 p-3 text-center text-sm">
            ✅ Aktivní {plan.plan === "premium_yearly" ? "roční" : "měsíční"} Premium
            {plan.current_period_end && (
              <> · do {new Date(plan.current_period_end).toLocaleDateString("cs-CZ")}</>
            )}
            {plan.cancel_at_period_end && <span className="ml-1 text-amber-300">(zrušeno na konci období)</span>}
            <div className="mt-2">
              <button onClick={goPortal} disabled={busy === "portal"}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {busy === "portal" && <Loader2 className="h-3 w-3 animate-spin" />} Správa předplatného
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* FREE */}
          <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zdarma</div>
            <div className="mt-1 text-3xl font-bold">0 Kč<span className="text-sm font-normal text-muted-foreground"> / měs</span></div>
            <ul className="mt-5 space-y-2 text-sm">
              <Bullet>4 hlavní české portály (Sreality, Bazoš, Bezrealitky, iDnes)</Bullet>
              <Bullet muted>Inzeráty starší 24 hodin</Bullet>
            </ul>

            <div className="mt-5 rounded-lg border border-border bg-[var(--color-surface-2)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bez přihlášení</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                <Bullet>Max. 20 výsledků na dotaz</Bullet>
                <Bullet muted>Bez ukládání inzerátů</Bullet>
                <Bullet muted>Bez hlídacího psa</Bullet>
                <Bullet muted>Bez AI analýzy</Bullet>
              </ul>
            </div>

            <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Po bezplatné registraci</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                <Bullet>Až 50 výsledků na dotaz</Bullet>
                <Bullet>Ukládání oblíbených inzerátů (neomezeně)</Bullet>
                <Bullet>1 hlídací pes (denní souhrn 06:00)</Bullet>
                <Bullet>1× zdarma ukázková AI analýza</Bullet>
              </ul>
            </div>

            <div className="mt-6">
              {!plan?.is_premium && !authed && (
                <Link to="/auth" className="inline-flex w-full justify-center rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground hover:bg-primary/20">
                  Registrovat se zdarma
                </Link>
              )}
              {!plan?.is_premium && authed && (
                <span className="inline-flex w-full justify-center rounded-md border border-border bg-[var(--color-surface-2)] px-4 py-2 text-sm font-semibold text-muted-foreground">Aktuální plán</span>
              )}
            </div>
          </div>

          {/* PREMIUM */}
          <div className="relative rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/10 to-transparent p-6 shadow-xl">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
              <Crown className="-mt-0.5 mr-1 inline h-3 w-3" /> Premium
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Pro investory</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold">349 Kč</span><span className="text-sm text-muted-foreground">/ měs</span>
            </div>
            <div className="text-xs text-muted-foreground">nebo 3 490 Kč / rok (ušetříte 17 %)</div>
            <ul className="mt-5 space-y-2 text-sm">
              <Bullet>4 hlavní české portály (Sreality, Bazoš, Bezrealitky, iDnes)</Bullet>
              <Bullet>Inzeráty <strong>v reálném čase</strong> — bez 24h zpoždění</Bullet>
              <Bullet>Až 500 výsledků na dotaz</Bullet>
              <Bullet>Neomezeně hlídacích psů (okamžitá upozornění e-mailem)</Bullet>
              <Bullet>AI analýza investice — 50× měsíčně</Bullet>
              <Bullet>XLS export</Bullet>
              <Bullet>Prioritní podpora</Bullet>
            </ul>
            {!plan?.is_premium && (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <button onClick={() => setBilling("monthly")} className={`font-semibold ${billing === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Měsíčně</button>
                  <button role="switch" aria-label="Roční platba" aria-checked={billing === "yearly"} onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")} className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary/20 transition-colors focus-visible:outline-2">
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-primary transition-transform ${billing === "yearly" ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <button onClick={() => setBilling("yearly")} className={`font-semibold ${billing === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
                    Ročně <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">-17 %</span>
                  </button>
                </div>
                
                <button onClick={() => goCheckout(billing === "yearly" ? "premium_yearly" : "premium_monthly")} disabled={busy !== null || authed === null || !paymentEnvironment || paymentEnvironment.mode === "unavailable" || search.checkout === "success"}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy !== null && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Aktivovat Premium — {billing === "yearly" ? "3 490 Kč / rok" : "349 Kč / měs"}
                </button>
                
                <div className="mt-2 space-y-2 text-center text-xs font-medium text-muted-foreground">
                  <p>Obnovování můžete kdykoli vypnout ve správě předplatného.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {err && <p className="mt-4 text-center text-sm text-[var(--color-danger)]">{err}</p>}
        <p className="mt-12 text-center text-xs text-muted-foreground">
          Platba přes Stripe · po zrušení obnovování Premium doběhne do konce zaplaceného období
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Aktivací předplatného souhlasíte s{" "}
          <Link to="/obchodni-podminky" className="text-primary hover:underline">obchodními podmínkami</Link>{" "}
          a berete na vědomí{" "}
          <Link to="/ochrana-osobnich-udaju" className="text-primary hover:underline">ochranu osobních údajů</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Bullet({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${muted ? "text-muted-foreground line-through opacity-70" : ""}`}>
      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${muted ? "text-muted-foreground" : "text-primary"}`} /> <span>{children}</span>
    </li>
  );
}
