import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, LogOut, Bookmark, User as UserIcon, Dog } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);

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

  return (
    <div className="flex items-center gap-1.5">
      <Link
        to="/saved"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/50"
      >
        <Bookmark className="h-3.5 w-3.5 text-primary" /> Uložené
      </Link>
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
