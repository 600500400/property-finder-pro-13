import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Radar } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Přihlášení — RealityScanner" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (search.next) {
        window.location.href = search.next;
      } else {
        navigate({ to: "/saved" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setMsg(null);
    if (!email) {
      setError("Pro obnovu hesla zadejte svůj e-mail nahoru do pole.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth?next=" + (search.next || "/"),
      });
      if (error) throw error;
      setMsg("Odkaz pro obnovu hesla byl odeslán na váš e-mail.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">Reality<span className="text-primary">Scanner</span></h1>
        </div>
        <h2 className="mb-1 text-lg font-semibold">{mode === "signin" ? "Přihlášení" : "Vytvořit účet"}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {mode === "signin" ? "Přihlaste se a spravujte uložené filtry a denní reporty." : "Vytvořte si účet a začněte ukládat filtry."}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="rounded-lg border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo (min. 6 znaků)"
            className="rounded-lg border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error && <p className="rounded bg-[var(--color-danger)]/10 px-2 py-1.5 text-xs text-[var(--color-danger)]">{error}</p>}
          {msg && <p className="rounded bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">{msg}</p>}
          <button
            type="submit" disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Přihlásit se" : "Vytvořit účet"}
          </button>
        </form>
        {mode === "signin" && (
          <button
            type="button" onClick={handleResetPassword} disabled={busy}
            className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Zapomněli jste heslo?
          </button>
        )}
        <button
          type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Nemáte účet? Vytvořit nový" : "Máte již účet? Přihlásit se"}
        </button>
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">← Zpět na scanner</Link>
      </div>
    </div>
  );
}
