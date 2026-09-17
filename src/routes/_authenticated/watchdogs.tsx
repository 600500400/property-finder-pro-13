import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSavedSearches, deleteSavedSearch, toggleSavedSearch,
} from "@/lib/alerts/saved-searches.functions";
import { Dog, Trash2, Pause, Play, ChevronLeft, Loader2, Mail, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/watchdogs")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Hlídací psi — RealityScanner" }] }),
  component: WatchdogsPage,
});

type SavedSearch = {
  id: string; name: string;
  filters: Record<string, unknown>;
  min_yield: number | null;
  frequency: "instant" | "daily";
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
};

function summarizeFilters(f: Record<string, unknown>): string {
  const parts: string[] = [];
  if (f.deal_type) parts.push(String(f.deal_type));
  if (f.property_type) parts.push(String(f.property_type));
  if (f.region) parts.push(String(f.region));
  if (f.price_max) parts.push(`do ${(Number(f.price_max) / 1_000_000).toFixed(1)} mil. Kč`);
  if (Array.isArray(f.sources) && f.sources.length > 0) parts.push(`${f.sources.length} zdroj(ů)`);
  return parts.join(" · ") || "Žádné filtry";
}

function WatchdogsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSavedSearches);
  const del = useServerFn(deleteSavedSearch);
  const toggle = useServerFn(toggleSavedSearch);
  const q = useQuery({ queryKey: ["saved_searches"], queryFn: () => list() });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_searches"] }),
  });
  const togM = useMutation({
    mutationFn: (args: { id: string; is_active: boolean }) => toggle({ data: args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_searches"] }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Scanner
        </Link>
        <h1 className="flex items-center gap-2 text-base font-bold">
          <Dog className="h-4 w-4 text-primary" /> Moji hlídací psi
        </h1>
      </header>

      <main className="mx-auto max-w-3xl p-5">
        <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          ℹ️ Aktuálně doručujeme jen na e-mail majitele Resend účtu (sandbox).
          Po ověření vlastní domény začnou maily chodit přímo tobě.
        </p>

        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

        {q.data && q.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Dog className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-sm text-muted-foreground">
              Zatím nemáš žádného hlídacího psa. Nastav si filtry na <Link to="/" className="text-primary underline">Scanneru</Link> a klikni „Uložit hledání“.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {(q.data as SavedSearch[] | undefined)?.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{s.name}</span>
                    <Badge freq={s.frequency} />
                    {!s.is_active && <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pozastaveno</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{summarizeFilters(s.filters)}</div>
                  {s.min_yield != null && (
                    <div className="mt-1 text-xs text-primary">Min. výnos: {s.min_yield}%</div>
                  )}
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {s.last_notified_at
                      ? `Naposledy upozorněno: ${new Date(s.last_notified_at).toLocaleString("cs-CZ")}`
                      : "Ještě bez upozornění"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => togM.mutate({ id: s.id, is_active: !s.is_active })}
                    title={s.is_active ? "Pozastavit" : "Spustit"}
                    className="rounded-md border border-border bg-[var(--color-surface-2)] p-2 text-muted-foreground hover:text-foreground"
                  >
                    {s.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Smazat hlídacího psa „${s.name}“?`)) delM.mutate(s.id); }}
                    title="Smazat"
                    className="rounded-md border border-border bg-[var(--color-surface-2)] p-2 text-muted-foreground hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Badge({ freq }: { freq: "instant" | "daily" }) {
  if (freq === "instant") {
    return <span className="flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400"><Zap className="h-3 w-3" /> Okamžitě</span>;
  }
  return <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary"><Mail className="h-3 w-3" /> Denně</span>;
}
