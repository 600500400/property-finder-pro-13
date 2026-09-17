import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getScraperHealth } from "@/lib/health/health.functions";

export const Route = createFileRoute("/_authenticated/health")({
  staticData: { sitemap: false },
  component: HealthPage,
});

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("cs-CZ");
}

function HealthPage() {
  const fetchHealth = useServerFn(getScraperHealth);
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["scraper-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Načítám…</div>;
  }
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/forbidden/i.test(msg)) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-2">403 — Pouze pro administrátory</h1>
          <button className="text-sm underline" onClick={() => router.navigate({ to: "/" })}>
            Zpět
          </button>
        </div>
      );
    }
    return <div className="p-6 text-sm text-[var(--color-danger)]">Chyba: {msg}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Health monitor scraperů</h1>
          <p className="text-sm text-muted-foreground">Per-source poslední běh vs baseline (medián posledních 10 úspěšných).</p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
          disabled={isFetching}
        >
          {isFetching ? "…" : "Refresh"}
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Zdroj</th>
              <th className="px-3 py-2 text-left">Stav</th>
              <th className="px-3 py-2 text-left">Poslední běh</th>
              <th className="px-3 py-2 text-right">items_found</th>
              <th className="px-3 py-2 text-right">baseline</th>
              <th className="px-3 py-2 text-right">úspěšných 24h</th>
              <th className="px-3 py-2 text-left">Poznámky</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((h) => {
              const color =
                h.indicator === "green"
                  ? "bg-emerald-500"
                  : h.indicator === "amber"
                  ? "bg-amber-500"
                  : "bg-red-500";
              return (
                <tr key={h.source} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${color}`} />
                    {h.source}
                  </td>
                  <td className="px-3 py-2">{h.last_status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtTime(h.last_started_at)}</td>
                  <td className="px-3 py-2 text-right font-mono">{h.last_items_found ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{h.baseline_median ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{h.successful_runs_24h}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {h.reasons.length === 0 ? "OK" : h.reasons.join(" · ")}
                    {h.last_error ? <div className="mt-1 text-[var(--color-danger)]">{h.last_error}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
