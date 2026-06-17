import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, LogOut, Bookmark, User as UserIcon, Dog, CreditCard, Crown, SlidersHorizontal } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePlan } from "@/hooks/usePlan";
import { createPortalSession } from "@/lib/billing/checkout.functions";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const { data: plan } = usePlan();
  const portal = useServerFn(createPortalSession);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/50"
      >
        <LogIn className="h-3.5 w-3.5" /> Přihlásit
      </Link>
    );
  }

  const openPortal = async () => {
    setBusy(true);
    try {
      const { url } = await portal();
      if (url) window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1.5">
      {plan?.is_premium ? (
        <span className="hidden items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black sm:inline-flex">
          <Crown className="h-3 w-3" /> Premium
        </span>
      ) : (
        <Link to="/cenik" className="hidden items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 sm:inline-flex">
          Upgradovat
        </Link>
      )}
      <Link
        to="/watchdogs"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/50"
      >
        <Dog className="h-3.5 w-3.5 text-primary" /> Hlídací psi
      </Link>
      <Link
        to="/saved"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/50"
      >
        <Bookmark className="h-3.5 w-3.5 text-primary" /> Uložené
      </Link>
      <Link
        to="/nastaveni-investora"
        title="Nastavení investora"
        className="rounded-lg border border-border bg-[var(--color-surface-2)] p-1.5 text-muted-foreground hover:text-foreground"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </Link>
      {plan?.is_premium && (
        <button
          onClick={openPortal}
          disabled={busy}
          title="Správa předplatného"
          className="rounded-lg border border-border bg-[var(--color-surface-2)] p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <CreditCard className="h-3.5 w-3.5" />
        </button>
      )}

      <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
        <UserIcon className="h-3.5 w-3.5" /> {user.email}
      </span>
      <button
        onClick={() => supabase.auth.signOut()}
        className="rounded-lg border border-border bg-[var(--color-surface-2)] p-1.5 text-muted-foreground hover:text-foreground"
        title="Odhlásit"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
