import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckoutSession } from "@/lib/billing/checkout.functions";
import { X, Crown, Loader2, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: Props) {
  const checkout = useServerFn(createCheckoutSession);
  const [busy, setBusy] = useState<"premium_monthly" | "premium_yearly" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const go = async (plan: "premium_monthly" | "premium_yearly") => {
    setBusy(plan); setErr(null);
    try {
      const { url } = await checkout({ data: { plan } });
      if (url) window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-foreground">Aktivovat Premium</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {reason && (
          <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-200/90">
            {reason}
          </p>
        )}

        <ul className="mb-4 space-y-1.5 text-xs text-foreground">
          {[
            "Inzeráty v reálném čase (bez 24h zpoždění)",
            "Neomezený počet výsledků",
            "Neomezeně hlídacích psů + okamžitá upozornění",
            "Export výsledků do XLS",
            "Prioritní podpora",
          ].map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {f}
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => go("premium_monthly")}
            disabled={busy !== null}
            className="rounded-lg border border-border bg-[var(--color-surface-2)] p-3 text-left hover:border-primary/50 disabled:opacity-50"
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Měsíčně</div>
            <div className="text-base font-bold text-foreground">349 Kč<span className="text-xs font-normal text-muted-foreground"> / měs</span></div>
            {busy === "premium_monthly" && <Loader2 className="mt-1 h-3 w-3 animate-spin" />}
          </button>
          <button
            onClick={() => go("premium_yearly")}
            disabled={busy !== null}
            className="rounded-lg border-2 border-primary bg-primary/10 p-3 text-left hover:bg-primary/15 disabled:opacity-50"
          >
            <div className="text-[11px] uppercase tracking-wider text-primary">Ročně · -17 %</div>
            <div className="text-base font-bold text-foreground">3 490 Kč<span className="text-xs font-normal text-muted-foreground"> / rok</span></div>
            {busy === "premium_yearly" && <Loader2 className="mt-1 h-3 w-3 animate-spin" />}
          </button>
        </div>

        {err && <p className="mt-3 text-xs text-[var(--color-danger)]">{err}</p>}
        <p className="mt-3 text-[10px] text-muted-foreground">Zrušení kdykoli v Správě předplatného. Bezpečné placení přes Stripe.</p>
      </div>
    </div>
  );
}
