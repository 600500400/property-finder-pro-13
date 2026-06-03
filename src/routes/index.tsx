import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";

import { runScan } from "@/lib/scanner/scan.functions";
import { sortListings } from "@/lib/scanner/sort";
import type { Listing, ScanFilters, ScanResult } from "@/lib/scanner/types";
import { FilterSidebar, MobileScanFooter } from "@/components/FilterSidebar";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/ListingCardSkeleton";
import { DiagnosticsBar } from "@/components/DiagnosticsBar";
import { Radar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealityScanner — analýza investičních nemovitostí" },
      { name: "description", content: "Skenuj inzeráty z českých realitních portálů a okamžitě vyhodnoť výnosnost." },
    ],
  }),
  component: Index,
});

const DEFAULT_FILTERS: ScanFilters = {
  deal_type: "prodej",
  property_type: "byty",
  sub_type: "",
  region: "",
  sources: [],
  sort_by: "date_desc",
  per_source_limit: 20,
};

const DEFAULT_VIEW = { only_with_image: false, dedupe: false };
const LAST_FILTERS_KEY = "realityscanner.lastFilters";
const LAST_VIEW_KEY = "realityscanner.lastView";

function toCsv(results: Listing[]): string {
  const headers = [
    "source", "name", "locality", "area", "price_text", "price", "url",
    "gross_yield", "net_yield", "payback_years", "stars", "verdict",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = results.map(r => [
    r.source, r.name, r.locality, r.area, r.price_text, r.price, r.url,
    r.invest?.gross_yield ?? "", r.invest?.net_yield ?? "",
    r.invest?.payback_years ?? "", r.invest?.stars ?? "", r.invest?.verdict ?? "",
  ].map(escape).join(","));
  return "\ufeff" + [headers.join(","), ...rows].join("\n");
}

function Index() {
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState(DEFAULT_VIEW);

  // Load persisted filters/view on mount
  useEffect(() => {
    try {
      const f = localStorage.getItem(LAST_FILTERS_KEY);
      if (f) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(f) });
      const v = localStorage.getItem(LAST_VIEW_KEY);
      if (v) setView({ ...DEFAULT_VIEW, ...JSON.parse(v) });
    } catch { /* ignore */ }
  }, []);
  // Persist
  useEffect(() => {
    try { localStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);
  useEffect(() => {
    try { localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ }
  }, [view]);

  const scanFn = useServerFn(runScan);
  const mutation = useMutation({
    mutationFn: (f: ScanFilters) => scanFn({ data: f }),
  });

  const data: ScanResult | undefined = mutation.data;

  const listings = useMemo(() => {
    let arr = data?.results ?? [];
    if (view.only_with_image) arr = arr.filter(l => !!l.img);
    if (view.dedupe) {
      const seen = new Set<string>();
      arr = arr.filter(l => {
        const k = `${(l.locality || "").toLowerCase()}|${l.price || 0}`;
        if (l.price === 0 || !l.locality) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    return sortListings(arr, filters.sort_by);
  }, [data?.results, view.only_with_image, view.dedupe, filters.sort_by]);

  const groupedBySource = useMemo(() => {
    if (filters.sort_by !== "source") return null;
    const map = new Map<string, Listing[]>();
    for (const l of listings) {
      if (!map.has(l.source)) map.set(l.source, []);
      map.get(l.source)!.push(l);
    }
    return Array.from(map.entries());
  }, [listings, filters.sort_by]);

  const handleExport = () => {
    if (!listings.length) return;
    const csv = toCsv(listings);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reality_scanner_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const skeletonCount = Math.min(12, filters.sources.length * 4 || 8);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Radar className="h-5 w-5 text-primary" />
        <div className="text-base font-bold tracking-tight">
          Reality<span className="text-primary">Scanner</span>
        </div>
        {data && (
          <span className="font-mono text-[11px] text-muted-foreground">
            · {new Date(data.ts).toLocaleTimeString("cs-CZ")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
              {listings.length}
            </span>
          )}
        </div>
      </header>

      <div className="grid flex-1 overflow-hidden md:grid-cols-[300px_1fr]">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          view={view}
          setView={setView}
          onScan={() => mutation.mutate(filters)}
          onExport={handleExport}
          scanning={mutation.isPending}
          canExport={listings.length > 0}
        />

        <main className="overflow-y-auto p-5 pb-24 md:pb-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {mutation.isPending ? (
                "Skenuji..."
              ) : data ? (
                <><strong className="text-foreground">{listings.length}</strong> inzerátů zobrazeno
                  {listings.length !== data.count && (
                    <span className="ml-1 text-xs">(z {data.count} po filtrech)</span>
                  )}
                </>
              ) : (
                "Připraven ke skenování"
              )}
            </div>
          </div>

          {data && <DiagnosticsBar items={data.diagnostics} meta={data.meta} />}

          {mutation.isPending && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-6 text-center">
              <p className="text-sm text-[var(--color-danger)]">
                Chyba: {(mutation.error as Error).message}
              </p>
            </div>
          )}

          {!mutation.isPending && !data && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
              <div className="mb-3 text-5xl">🏠</div>
              <h3 className="text-lg font-semibold">Reality Scanner</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filters.sources.length === 0
                  ? "Vyber vlevo alespoň jeden realitní server a klikni na „Skenovat nemovitosti”."
                  : "Nastav filtry vlevo a klikni na „Skenovat nemovitosti”."}
              </p>
            </div>
          )}

          {data && listings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <div className="mb-2 text-4xl">🔍</div>
              <p className="text-sm text-muted-foreground">Žádné inzeráty neodpovídají filtrům.</p>
            </div>
          )}

          {groupedBySource ? (
            <div className="flex flex-col gap-6">
              {groupedBySource.map(([source, items]) => {
                const diag = data?.diagnostics.find(d => d.source === source);
                return (
                  <section key={source}>
                    <div className="mb-3 flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-semibold text-foreground">{source}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {items.length} inz.{diag ? ` · ${diag.ms}ms` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {items.map((l, i) => <ListingCard key={l.url + i} listing={l} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            listings.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {listings.map((l, i) => <ListingCard key={l.url + i} listing={l} />)}
              </div>
            )
          )}
        </main>
      </div>

      <MobileScanFooter
        onScan={() => mutation.mutate(filters)}
        onExport={handleExport}
        scanning={mutation.isPending}
        canExport={listings.length > 0}
        sourcesCount={filters.sources.length}
      />
    </div>
  );
}
