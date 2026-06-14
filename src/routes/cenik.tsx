import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2, ArrowLeft } from "lucide-react";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/checkout.functions";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/cenik")({
  head: () => ({
    meta: [
      { title: "Ceník — RealityScanner" },
      { name: "description", content: "Free zdarma nebo Premium za 349 Kč měsíčně. Inzeráty v reálném čase, neomezení hlídací psi, CSV export." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { data: plan, refetch } = usePlan();
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createPortalSession);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("checkout") === "success") {
      // Webhook may not have landed yet — poll briefly
      let n = 0;
      const t = setInterval(() => { refetch(); if (++n > 10) clearInterval(t); }, 1500);
      return () => clearInterval(t);
    }
  }, [refetch]);

  const goCheckout = async (planKey: "premium_monthly" | "premium_yearly") => {
    if (!authed) { window.location.href = "/auth?next=/cenik"; return; }
    setBusy(planKey); setErr(null);
    try {
      const { url } = await checkout({ data: { plan: planKey } });
      if (url) window.location.href = url;
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
              <Bullet>Vyhledávání ve všech 7 portálech</Bullet>
              <Bullet>Max. 20 výsledků na dotaz</Bullet>
              <Bullet muted>Inzeráty starší 24 hodin</Bullet>
              <Bullet>1 hlídací pes (denní souhrn 06:00)</Bullet>
              <Bullet muted>Bez CSV exportu</Bullet>
              <Bullet muted>Bez okamžitých upozornění</Bullet>
            </ul>
            <div className="mt-6">
              {!plan?.is_premium && (
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
            <div className="text-xs text-muted-foreground">nebo 3 490 Kč / rok (ušetříš 17 %)</div>
            <ul className="mt-5 space-y-2 text-sm">
              <Bullet>Inzeráty <strong>v reálném čase</strong> — bez 24h zpoždění</Bullet>
              <Bullet>Neomezený počet výsledků</Bullet>
              <Bullet>Neomezeně hlídacích psů</Bullet>
              <Bullet>Okamžitá upozornění e-mailem</Bullet>
              <Bullet>CSV export</Bullet>
              <Bullet>Prioritní podpora</Bullet>
            </ul>
            {!plan?.is_premium && (
              <div className="mt-6 grid gap-2">
                <button onClick={() => goCheckout("premium_monthly")} disabled={busy !== null}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-bold text-foreground hover:bg-primary/20 disabled:opacity-50">
                  {busy === "premium_monthly" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Aktivovat Premium — měsíčně
                </button>
                <button onClick={() => goCheckout("premium_yearly")} disabled={busy !== null}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy === "premium_yearly" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Aktivovat Premium — ročně (−17 %)
                </button>
              </div>
            )}
          </div>
        </div>

        {err && <p className="mt-4 text-center text-sm text-[var(--color-danger)]">{err}</p>}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Platba přes Stripe · zrušení kdykoli · sandbox / TEST MODE
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
