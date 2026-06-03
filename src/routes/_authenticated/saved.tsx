import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listSavedFilters, deleteSavedFilter,
  listScheduledScans, upsertScheduledScan, deleteScheduledScan,
} from "@/lib/saved/saved.functions";
import { Bookmark, Calendar, Mail, Trash2, ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Uložené filtry — RealityScanner" }] }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const listFilters = useServerFn(listSavedFilters);
  const deleteFilter = useServerFn(deleteSavedFilter);
  const listSchedules = useServerFn(listScheduledScans);
  const upsertSchedule = useServerFn(upsertScheduledScan);
  const deleteSchedule = useServerFn(deleteScheduledScan);

  const filtersQ = useQuery({ queryKey: ["saved_filters"], queryFn: () => listFilters() });
  const schedQ = useQuery({ queryKey: ["scheduled_scans"], queryFn: () => listSchedules() });

  const delFilterM = useMutation({
    mutationFn: (id: string) => deleteFilter({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_filters"] }),
  });
  const delSchedM = useMutation({
    mutationFn: (id: string) => deleteSchedule({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled_scans"] }),
  });

  const [me, setMe] = useState<string | null>(null);
  useState(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.email ?? null)); });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Scanner
        </Link>
        <h1 className="text-base font-bold">Uložené filtry & automatizace</h1>
      </header>

      <main className="mx-auto max-w-3xl p-5">
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Bookmark className="h-4 w-4 text-primary" /> Moje uložené filtry
          </h2>
          {filtersQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {filtersQ.data && filtersQ.data.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Zatím žádné uložené filtry. Vrať se na <Link to="/" className="text-primary underline">Scanner</Link> a klikni „Uložit“.
            </p>
          )}
          {filtersQ.data && filtersQ.data.map((f) => (
            <div key={f.id} className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Bookmark className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{f.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString("cs-CZ")}</span>
              <button onClick={() => delFilterM.mutate(f.id)} className="text-muted-foreground hover:text-[var(--color-danger)]">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" /> Automatické skenování + email
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Vyber uložený filtr, frekvenci a email pro denní report. Cron běží serverově každých 30 minut.
          </p>

          <NewScheduleForm
            filters={filtersQ.data ?? []}
            defaultEmail={me ?? ""}
            onSaved={() => qc.invalidateQueries({ queryKey: ["scheduled_scans"] })}
            mutate={upsertSchedule}
          />

          <div className="mt-4 flex flex-col gap-2">
            {schedQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {schedQ.data && schedQ.data.length === 0 && (
              <p className="text-xs italic text-muted-foreground">Žádný scheduler není aktivní.</p>
            )}
            {schedQ.data?.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Mail className="h-4 w-4 text-primary" />
                <div className="flex-1 text-xs">
                  <div className="font-medium">{s.email} · {s.frequency_per_day}× denně</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {s.enabled ? "✓ Aktivní" : "○ Pozastaveno"} ·{" "}
                    {s.last_run_at ? `naposledy ${new Date(s.last_run_at).toLocaleString("cs-CZ")}` : "ještě nespuštěno"}
                  </div>
                </div>
                <button onClick={() => delSchedM.mutate(s.id)} className="text-muted-foreground hover:text-[var(--color-danger)]">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function NewScheduleForm({
  filters, defaultEmail, onSaved, mutate,
}: {
  filters: Array<{ id: string; name: string; filters: unknown }>;
  defaultEmail: string;
  onSaved: () => void;
  mutate: (args: { data: any }) => Promise<{ id: string }>;
}) {
  const [filterId, setFilterId] = useState<string>("");
  const [email, setEmail] = useState(defaultEmail);
  const [freq, setFreq] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = filters.find((x) => x.id === filterId);
    if (!f) { setMsg("Vyber filtr"); return; }
    setBusy(true);
    try {
      await mutate({ data: {
        saved_filter_id: filterId,
        filters: f.filters,
        email,
        frequency_per_day: freq,
        max_per_email: 20,
        enabled: true,
      }});
      setMsg("Naplánováno ✓");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (filters.length === 0) {
    return <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">Nejdřív si ulož filtr na Scanneru.</p>;
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto_auto]">
      <select value={filterId} onChange={(e) => setFilterId(e.target.value)} className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-2 text-sm">
        <option value="">— vyber filtr —</option>
        {filters.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-2 text-sm" />
      <select value={freq} onChange={(e) => setFreq(Number(e.target.value))} className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-2 text-sm">
        <option value={1}>1× denně</option>
        <option value={2}>2× denně</option>
        <option value={3}>3× denně</option>
      </select>
      <button disabled={busy} className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy && <Loader2 className="h-3 w-3 animate-spin" />} Naplánovat
      </button>
      {msg && <p className="col-span-full text-xs text-muted-foreground">{msg}</p>}
    </form>
  );
}
