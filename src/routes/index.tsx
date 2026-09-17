import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";

import { queryListings } from "@/lib/listings/query.functions";
import { sortListings } from "@/lib/scanner/sort";
import type { Listing, ScanFilters, ScanResult } from "@/lib/scanner/types";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ListingCard, type Density } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/ListingCardSkeleton";
import { UserMenu } from "@/components/UserMenu";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { Radar, SlidersHorizontal, LayoutGrid, Rows3, List, Download, Crown } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealityScanner — analýza investičních nemovitostí" },
      { name: "description", content: "Prohlížej aktuální inzeráty z českých realitních portálů s okamžitým vyhodnocením výnosnosti." },
    ],
  }),
  component: Index,
});

type Freshness = "" | "24h" | "7d";

const DEFAULT_FILTERS: ScanFilters & { freshness: Freshness } = {
  deal_type: "prodej",
  property_type: "byty",
  property_types: ["byty", "domy"],
  sub_type: "",
  region: "",
  regions: [],
  sources: [],
  sort_by: "date_desc",
  per_source_limit: 100,
  freshness: "",
};

interface ViewOptions { dedupe: boolean; density: Density; [k: string]: unknown }
const DEFAULT_VIEW: ViewOptions = { dedupe: true, density: "card" };
const LAST_FILTERS_KEY = "realityscanner.lastFilters";
const LAST_VIEW_KEY = "realityscanner.lastView";

function gridClass(density: Density): string {
  if (density === "list") return "flex flex-col";
  if (density === "compact") return "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
  return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";
}

function Index() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  useEffect(() => {
    try {
      const f = localStorage.getItem(LAST_FILTERS_KEY);
      if (f) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(f) });
      const v = localStorage.getItem(LAST_VIEW_KEY);
      if (v) setView({ ...DEFAULT_VIEW, ...JSON.parse(v) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(filters)); } catch { /* ignore */ } }, [filters]);
  useEffect(() => { try { localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(view)); } catch { /* ignore */ } }, [view]);

  const queryFn = useServerFn(queryListings);
  const queryKey = useMemo(() => ["listings", filters], [filters]);
  const { data, isLoading, isFetching, isError, error } = useQuery<ScanResult>({
    queryKey,
    queryFn: () => queryFn({ data: filters }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

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

  const isPremium = data?.meta?.is_premium ?? false;
  const tier = data?.meta?.tier ?? "anonymous";
  const resultCap = data?.meta?.result_cap ?? 20;
  const freeCapped = data?.meta?.free_capped ?? false;

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!isPremium) {
      setUpgradeReason("Export do XLS je součástí Premia.");
      return;
    }
    if (!listings.length || exporting) return;
    setExporting(true);
    try {
      const { buildListingsXlsx, MAX_EXPORT_ROWS } = await import("@/lib/export/xlsx-export");
      const res = await buildListingsXlsx(listings);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      if (res.truncated) {
        toast.warning(`Export omezen na ${MAX_EXPORT_ROWS.toLocaleString("cs-CZ")} řádků`, {
          description: `Filtr vrací ${res.totalRows.toLocaleString("cs-CZ")} inzerátů — soubor obsahuje prvních ${res.rows.toLocaleString("cs-CZ")}. Zužte filtr pro úplný export.`,
        });
      } else {
        toast.success(`Exportováno ${res.rows.toLocaleString("cs-CZ")} inzerátů`);
      }
    } catch (e) {
      toast.error("Export se nepovedl", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Radar className="h-5 w-5 text-primary" />
        <div className="flex flex-col leading-none">
          <div className="text-base font-bold tracking-tight">
            Reality<span className="text-primary">Scanner</span>
          </div>
          <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:block">
            Investiční byty a domy na prodej napříč českými portály
          </span>
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

      {/* Mobile filter trigger */}
      <div className="sticky top-[57px] z-20 flex items-center gap-2 border-b border-border bg-background/85 px-3 py-2 backdrop-blur md:hidden">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <button type="button" className="flex items-center gap-1.5 rounded-full border border-border bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-semibold text-foreground active:scale-95">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Filtry
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-0">
            <SheetHeader className="border-b border-border p-4"><SheetTitle>Filtry</SheetTitle></SheetHeader>
            <FilterSidebar
              filters={filters}
              setFilters={(f) => setFilters({ ...filters, ...f })}
              view={view}
              setView={(v) => setView({ ...view, ...v, density: (v.density as Density) ?? view.density })}
              onExport={handleExport}
              canExport={listings.length > 0}
            />
          </SheetContent>
        </Sheet>
        <FreshnessToggle value={filters.freshness} onChange={(v) => setFilters({ ...filters, freshness: v })} compact />
        <button onClick={handleExport} disabled={isPremium && !listings.length}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> XLS {!isPremium && <Crown className="h-3 w-3 text-amber-400" />}
        </button>
      </div>

      <div className="grid flex-1 min-h-0 overflow-hidden md:grid-cols-[300px_1fr]">
        <div className="hidden min-h-0 overflow-y-auto md:block">
          <FilterSidebar
            filters={filters}
            setFilters={(f) => setFilters({ ...filters, ...f })}
            view={view}
            setView={(v) => setView({ ...view, ...v, density: (v.density as Density) ?? view.density })}
            onExport={handleExport}
            canExport={listings.length > 0}
          />
        </div>

        <main className="overflow-y-auto p-3 pb-6 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Načítám…" : (
                <><strong className="text-foreground">{listings.length}</strong> inz.
                  {isFetching && !isLoading && <span className="ml-2 text-xs">(aktualizuji…)</span>}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Řadit</span>
                <select
                  value={filters.sort_by}
                  onChange={(e) => setFilters({ ...filters, sort_by: e.target.value as ScanFilters["sort_by"] })}
                  className="bg-transparent text-sm font-semibold text-foreground outline-none"
                >
                  <option value="date_desc">Nejnovější</option>
                  <option value="price_asc">Cena – nejlevnější</option>
                  <option value="price_desc">Cena – nejdražší</option>
                  <option value="yield">Výnos – nejvyšší</option>
                  <option value="source">Dle zdroje</option>
                </select>
              </label>
              <div className="hidden md:block">
                <FreshnessToggle value={filters.freshness} onChange={(v) => setFilters({ ...filters, freshness: v })} />
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-[var(--color-surface-2)] p-0.5">
                <DensityBtn current={view.density} value="card" onClick={(v) => setView({ ...view, density: v })} icon={<LayoutGrid className="h-3.5 w-3.5" />} title="Karty" />
                <DensityBtn current={view.density} value="compact" onClick={(v) => setView({ ...view, density: v })} icon={<Rows3 className="h-3.5 w-3.5" />} title="Kompakt" />
                <DensityBtn current={view.density} value="list" onClick={(v) => setView({ ...view, density: v })} icon={<List className="h-3.5 w-3.5" />} title="Seznam" />
              </div>
            </div>
          </div>


          {!isLoading && data && !isPremium && <UpgradeBanner />}
          {freeCapped && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-center text-xs text-amber-200/90">
              {tier === "anonymous" ? (
                <>Bez přihlášení vidíte max. <strong>{resultCap} výsledků</strong> · <Link to="/auth" className="underline">registrovat zdarma pro 50</Link></>
              ) : (
                <>Free plán zobrazuje max. <strong>{resultCap} výsledků</strong> · <button className="underline" onClick={() => setUpgradeReason("Odemkněte neomezené výsledky.")}>upgradovat na Premium</button></>
              )}
            </div>
          )}

          {isLoading && (
            <div className={gridClass(view.density)}>
              {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-6 text-center">
              <p className="text-sm text-[var(--color-danger)]">Chyba: {(error as Error).message}</p>
            </div>
          )}

          {!isLoading && listings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <div className="mb-2 text-4xl">🔍</div>
              <p className="text-sm text-muted-foreground">Žádné inzeráty neodpovídají filtrům.</p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                Zrušit všechny filtry
              </button>
            </div>
          )}

          {listings.length > 0 && (
            <div className={gridClass(view.density)}>
              {listings.map((l, i) => <ListingCard key={l.url + i} listing={l} density={view.density} />)}
            </div>
          )}

          <div className="mt-8 md:hidden">
            <Footer />
          </div>
        </main>
      </div>

      <UpgradeModal open={!!upgradeReason} onClose={() => setUpgradeReason(null)} reason={upgradeReason ?? undefined} />
    </div>
  );
}


function FreshnessToggle({ value, onChange, compact }: { value: Freshness; onChange: (v: Freshness) => void; compact?: boolean }) {
  const opts: Array<[Freshness, string]> = [["", "Vše"], ["24h", "Novinky 24 h"], ["7d", "Novinky 7 dní"]];
  return (
    <div className={`flex items-center gap-0.5 rounded-lg border border-border bg-[var(--color-surface-2)] p-0.5 ${compact ? "text-[11px]" : "text-xs"}`}>
      {opts.map(([v, label]) => {
        const active = value === v;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`rounded-md px-2.5 py-1 font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {compact ? label.replace("Novinky ", "") : label}
          </button>
        );
      })}
    </div>
  );
}

function DensityBtn({ current, value, onClick, icon, title }: {
  current: Density; value: Density; onClick: (v: Density) => void; icon: React.ReactNode; title: string;
}) {
  const active = current === value;
  return (
    <button type="button" onClick={() => onClick(value)} title={title} aria-label={title} aria-pressed={active}
      className={`rounded-md p-1.5 transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {icon}
    </button>
  );
}
