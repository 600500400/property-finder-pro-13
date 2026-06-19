import { useState } from "react";
import { Crown, UserPlus } from "lucide-react";
import { UpgradeModal } from "./UpgradeModal";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "@tanstack/react-router";

export function UpgradeBanner() {
  const [open, setOpen] = useState(false);
  const { data: plan } = usePlan();
  const tier = plan?.tier ?? "anonymous";

  if (tier === "anonymous") {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/15 to-primary/5 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <UserPlus className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Vytvoř si zdarma účet</strong> — uvidíš 50 inzerátů (místo 20), uložíš si oblíbené a vyzkoušíš AI analýzu.
          </span>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90"
        >
          Registrovat zdarma
        </Link>
      </div>
    );
  }

  // Registered free → push realtime + unlimited AI
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-amber-100">
          <Crown className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong className="text-amber-200">Nejlepší investice mizí během hodin</strong> — Premium vidí inzeráty okamžitě (bez 24h zpoždění) a má 50 AI analýz měsíčně.
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-bold text-black hover:bg-amber-400"
        >
          Aktivovat Premium
        </button>
      </div>
      <UpgradeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
