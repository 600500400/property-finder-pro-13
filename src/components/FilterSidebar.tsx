import type { ScanFilters, SourceKey } from "@/lib/scanner/types";
import { Download, Dog } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SaveSearchDialog } from "@/components/SaveSearchDialog";




const REGIONS: Array<[ScanFilters["region"], string]> = [
  ["", "Celá ČR"], ["praha", "Praha"], ["stredocesky", "Středočeský"],
  ["jihocesky", "Jihočeský"], ["jihomoravsky", "Jihomoravský"],
  ["karlovarsky", "Karlovarský"], ["kralovehradecky", "Královéhradecký"],
  ["liberecky", "Liberecký"], ["moravskoslezsky", "Moravskoslezský"],
  ["olomoucky", "Olomoucký"], ["pardubicky", "Pardubický"],
  ["plzensky", "Plzeňský"], ["ustecky", "Ústecký"],
  ["vysocina", "Vysočina"], ["zlinsky", "Zlínský"],
];

// Note: hyperinzerce, realitymix and annonce are paused (cron unscheduled).
// Hidden from UI but scraper code/routes/DB rows remain intact for later re-enable.
const SOURCES: Array<{ key: SourceKey; label: string; dot: string }> = [
  { key: "sreality", label: "Sreality", dot: "var(--color-primary)" },
  { key: "bazos", label: "Bazoš", dot: "#e0a64b" },
  { key: "bezrealitky", label: "Bezrealitky", dot: "#7aa2ff" },
  { key: "idnes", label: "iDnes Reality", dot: "#d06bd0" },
];
const ALL_KEYS = SOURCES.map(s => s.key);

interface ViewOptions {
  dedupe: boolean;
  // další klíče (např. density) může vlastník view držet také, FilterSidebar je nečte.
  [k: string]: unknown;
}



interface Props {
  filters: ScanFilters;
  setFilters: (f: ScanFilters) => void;
  view: ViewOptions;
  setView: (v: ViewOptions) => void;
  onExport: () => void;
  canExport: boolean;
}


export function FilterSidebar({ filters, setFilters, view, setView, onExport, canExport }: Props) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const [watchdogOpen, setWatchdogOpen] = useState(false);
  const saveCloud = useServerFn(upsertSavedFilter);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAuthed(!!s?.user));
    return () => subscription.unsubscribe();
  }, []);

  const update = <K extends keyof ScanFilters>(k: K, v: ScanFilters[K]) =>
    setFilters({ ...filters, [k]: v });

  const toggleSource = (s: SourceKey) => {
    const has = filters.sources.includes(s);
    update("sources", has ? filters.sources.filter(x => x !== s) : [...filters.sources, s]);
  };

  const handleSaveCloud = async () => {
    const name = window.prompt("Název filtru (uloží se do tvého účtu):")?.trim();
    if (!name) return;
    setCloudMsg("Ukládám…");
    try {
      await saveCloud({ data: { name, filters: filters as unknown as Record<string, unknown> } });
      setCloudMsg("Uloženo do účtu ✓");
      setTimeout(() => setCloudMsg(null), 2500);
    } catch (e) {
      setCloudMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-r border-border bg-[var(--color-surface)] p-5 pb-32 md:pb-5">
      <Section label="Lokalita">
        <Label>Kraj</Label>
        <Select value={filters.region} onChange={(v) => update("region", v as ScanFilters["region"])}
          options={REGIONS} />
      </Section>


      <Section label="Cena (Kč)">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Od</Label>
            <input
              type="number" min={0} step={10000} placeholder="0"
              value={filters.price_min ?? ""}
              onChange={(e) => update("price_min", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <Label>Do</Label>
            <input
              type="number" min={0} step={10000} placeholder="bez limitu"
              value={filters.price_max ?? ""}
              onChange={(e) => update("price_max", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </Section>


      <Section label="Zdroje dat">
        <div className="mb-1 flex gap-1.5">
          <button type="button" onClick={() => update("sources", ALL_KEYS)}
            className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Vše
          </button>
          <button type="button" onClick={() => update("sources", [])}
            className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Žádný
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {SOURCES.map((s) => {
            const checked = filters.sources.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSource(s.key)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                  checked
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-[var(--color-surface-2)] hover:border-primary/40"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full transition ${checked ? "" : "opacity-40"}`}
                  style={{ background: checked ? s.dot : "transparent", border: checked ? "none" : `1.5px solid ${s.dot}` }}
                />
                <span className="flex-1 text-foreground">{s.label}</span>
              </button>
            );
          })}
        </div>
      </Section>


      <Section label="Zobrazení">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={view.dedupe}
            onChange={(e) => setView({ ...view, dedupe: e.target.checked })}
            className="h-4 w-4 accent-primary" />
          Skrýt duplicity (lokalita + cena)
        </label>
      </Section>






      <Section label="Hlídací pes">
        <button
          type="button"
          onClick={() => isAuthed && setWatchdogOpen(true)}
          disabled={!isAuthed}
          title={isAuthed ? "Uložit hledání jako hlídacího psa" : "Přihlaste se pro uložení hledání"}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-[var(--color-surface-2)] disabled:text-muted-foreground"
        >
          <Dog className="h-3.5 w-3.5" /> {isAuthed ? "Uložit hledání" : "Přihlaste se pro hlídacího psa"}
        </button>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Dostaneš e-mail, jakmile přibyde nový inzerát odpovídající tomuto filtru.
        </p>
      </Section>

      {/* Desktop action button — export only (live scan removed, data is now DB-backed) */}
      <div className="mt-auto hidden flex-col gap-2 pt-2 md:flex">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/60 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="mt-3 hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground md:flex">
        <Link to="/cenik" className="hover:text-foreground">Ceník</Link>
        <Link to="/obchodni-podminky" className="hover:text-foreground">Obchodní podmínky</Link>
        <Link to="/ochrana-osobnich-udaju" className="hover:text-foreground">Soukromí</Link>
      </div>

      <SaveSearchDialog open={watchdogOpen} onClose={() => setWatchdogOpen(false)} filters={filters} />
    </aside>
  );
}



function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-medium text-muted-foreground">{children}</label>;
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}
