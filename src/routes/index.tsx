import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";

import { runScan } from "@/lib/scanner/scan.functions";
import { sortListings } from "@/lib/scanner/sort";
import type { Listing, ScanFilters, ScanResult } from "@/lib/scanner/types";
import { FilterSidebar, MobileScanFooter } from "@/components/FilterSidebar";
import { ListingCard, type Density } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/ListingCardSkeleton";
import { DiagnosticsBar } from "@/components/DiagnosticsBar";
import { UserMenu } from "@/components/UserMenu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Radar, SlidersHorizontal, LayoutGrid, Rows3, List, Zap, Loader2 } from "lucide-react";

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

interface ViewOptions {
  dedupe: boolean;
  density: Density;
  [k: string]: unknown;
}
const DEFAULT_VIEW: ViewOptions = { dedupe: false, density: "card" };
const LAST_FILTERS_KEY = "realityscanner.lastFilters";
const LAST_VIEW_KEY = "realityscanner.lastView";

const DEAL_LABEL: Record<string, string> = { prodej: "Prodej", pronajem: "Pronájem" };
const TYPE_LABEL: Record<string, string> = {
  byty: "Byty", domy: "Domy", pozemky: "Pozemky", komercni: "Komerční", ostatni: "Garáže",
};
const REGION_LABEL: Record<string, string> = {
  "": "Celá ČR", praha: "Praha", stredocesky: "Stř. kraj", jihocesky: "Jihočeský",
  jihomoravsky: "Jihomoravský", karlovarsky: "Karlovarský", kralovehradecky: "Královéhrad.",
  liberecky: "Liberecký", moravskoslezsky: "Mor.slezský", olomoucky: "Olomoucký",
  pardubicky: "Pardubický", plzensky: "Plzeňský", ustecky: "Ústecký",
  vysocina: "Vysočina", zlinsky: "Zlínský",
};

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

function gridClass(density: Density): string {
  if (density === "list") return "flex flex-col";
  if (density === "compact") return "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
  return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
}

function Index() {
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LAST_FILTERS_KEY);
      if (f) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(f) });
      const v = localStorage.getItem(LAST_VIEW_KEY);
      if (v) setView({ ...DEFAULT_VIEW, ...JSON.parse(v) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);
  useEffect(() => {
    try { localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ }
  }, [view]);

  const scanFn = useServerFn(runScan);
  const mutation = useMutation({
    mutationFn: (f: ScanFilters) => scanFn({ data: f }),
    onSuccess: () => {
      // Po skenu na mobilu automaticky zavři filtry, aby uživatel viděl výsledky.
      setMobileFiltersOpen(false);
    },
  });

  const data: ScanResult | undefined = mutation.data;

  const listings = useMemo(() => {
    let arr = data?.results ?? [];
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
  }, [data?.results, view.dedupe, filters.sort_by]);

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
  const handleScan = () => mutation.mutate(filters);

  const filterChips = [
    DEAL_LABEL[filters.deal_type],
    TYPE_LABEL[filters.property_type],
    REGION_LABEL[filters.region] || "Celá ČR",
    `${filters.sources.length} zdrojů`,
  ];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Radar className="h-5 w-5 text-primary" />
        <div className="text-base font-bold tracking-tight">
          Reality<span className="text-primary">Scanner</span>
        </div>
        {data && (
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            · {new Date(data.ts).toLocaleTimeString("cs-CZ")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
              {listings.length}
            </span>
          )}
          <UserMenu />
        </div>
      </header>

      {/* Mobile sticky chip bar — filtry + sken */}
      <div className="sticky top-[57px] z-20 flex items-center gap-2 border-b border-border bg-background/85 px-3 py-2 backdrop-blur md:hidden">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-semibold text-foreground active:scale-95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Filtry
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>Filtry</SheetTitle>
            </SheetHeader>
            <FilterSidebar
              filters={filters}
              setFilters={setFilters}
              view={view}
              setView={setView}
              onScan={handleScan}
              onExport={handleExport}
              scanning={mutation.isPending}
              canExport={listings.length > 0}
            />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center gap-1 overflow-x-auto text-[11px] text-muted-foreground">
          {filterChips.map((c, i) => (
            <span key={i} className="whitespace-nowrap rounded-full bg-muted/50 px-2 py-0.5">
              {c}
            </span>
          ))}
        </div>

        <button
          onClick={handleScan}
          disabled={mutation.isPending || filters.sources.length === 0}
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Skenovat
        </button>
      </div>

      <div className="grid flex-1 overflow-hidden md:grid-cols-[300px_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            view={view}
            setView={setView}
            onScan={handleScan}
            onExport={handleExport}
            scanning={mutation.isPending}
            canExport={listings.length > 0}
          />
        </div>

        <main className="overflow-y-auto p-3 pb-24 md:p-5 md:pb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {mutation.isPending ? (
                "Skenuji..."
              ) : data ? (
                <><strong className="text-foreground">{listings.length}</strong> inz.
                  {listings.length !== data.count && (
                    <span className="ml-1 text-xs">(z {data.count})</span>
                  )}
                </>
              ) : (
                "Připraven ke skenování"
              )}
            </div>

            {/* Density toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-[var(--color-surface-2)] p-0.5">
              <DensityBtn current={view.density} value="card" onClick={(v) => setView({ ...view, density: v })} icon={<LayoutGrid className="h-3.5 w-3.5" />} title="Karty" />
              <DensityBtn current={view.density} value="compact" onClick={(v) => setView({ ...view, density: v })} icon={<Rows3 className="h-3.5 w-3.5" />} title="Kompakt" />
              <DensityBtn current={view.density} value="list" onClick={(v) => setView({ ...view, density: v })} icon={<List className="h-3.5 w-3.5" />} title="Seznam" />
            </div>
          </div>

          {data && <DiagnosticsBar items={data.diagnostics} meta={data.meta} />}

          {mutation.isPending && (
            <div className={gridClass(view.density)}>
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
                  ? "Vyber alespoň jeden realitní server a klikni na „Skenovat”."
                  : "Nastav filtry a klikni na „Skenovat”."}
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
                    <div className={gridClass(view.density)}>
                      {items.map((l, i) => <ListingCard key={l.url + i} listing={l} density={view.density} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            listings.length > 0 && (
              <div className={gridClass(view.density)}>
                {listings.map((l, i) => <ListingCard key={l.url + i} listing={l} density={view.density} />)}
              </div>
            )
          )}
        </main>
      </div>

      {/* Mobile bottom CSV-export bar — jen když jsou data */}
      {listings.length > 0 && (
        <MobileScanFooter
          onScan={handleScan}
          onExport={handleExport}
          scanning={mutation.isPending}
          canExport={listings.length > 0}
          sourcesCount={filters.sources.length}
        />
      )}
    </div>
  );
}

function DensityBtn({
  current, value, onClick, icon, title,
}: {
  current: Density; value: Density; onClick: (v: Density) => void; icon: React.ReactNode; title: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`rounded-md p-1.5 transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
    </button>
  );
}
