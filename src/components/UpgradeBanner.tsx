import { useState } from "react";
import { Crown } from "lucide-react";
import { UpgradeModal } from "./UpgradeModal";

export function UpgradeBanner() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-amber-100">
          <Crown className="h-4 w-4 shrink-0 text-amber-400" />
          <span><strong className="text-amber-200">Nejlepší investice mizí během hodin</strong> — Premium vidí nové inzeráty okamžitě.</span>
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
