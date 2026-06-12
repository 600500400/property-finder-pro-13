import type { ScanFilters, SourceKey } from "@/lib/scanner/types";
import { Download, Save, Trash2, Bookmark, Cloud, Dog } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { upsertSavedFilter } from "@/lib/saved/saved.functions";
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

const SOURCES: Array<{ key: SourceKey; label: string; badge: string; type: "api" | "html" | "browser" }> = [
  { key: "sreality", label: "Sreality", badge: "API", type: "api" },
  { key: "bazos", label: "Bazoš", badge: "HTML", type: "html" },
  { key: "bezrealitky", label: "Bezrealitky", badge: "GraphQL", type: "api" },
  { key: "hyperinzerce", label: "Hyperinzerce", badge: "BROWSER", type: "browser" },
  { key: "realitymix", label: "RealityMix", badge: "BROWSER", type: "browser" },
  { key: "annonce", label: "Annonce", badge: "BROWSER", type: "browser" },
  { key: "idnes", label: "iDnes Reality", badge: "BROWSER", type: "browser" },
];
const ALL_KEYS = SOURCES.map(s => s.key);
const FAST_KEYS = SOURCES.filter(s => s.type !== "browser").map(s => s.key);

function badgeClass(type: "api" | "html" | "browser") {
  if (type === "api") return "bg-primary/15 text-primary";
  if (type === "html") return "bg-muted text-muted-foreground";
  return "bg-orange-500/15 text-orange-400";
}

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

const PRESET_KEY = "realityscanner.presets";

type Preset = { name: string; filters: ScanFilters };

function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePresets(list: Preset[]) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function FilterSidebar({ filters, setFilters, view, setView, onExport, canExport }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const saveCloud = useServerFn(upsertSavedFilter);

  useEffect(() => { setPresets(loadPresets()); }, []);
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

  const handleSavePreset = () => {
    const name = window.prompt("Název presetu:")?.trim();
    if (!name) return;
    const next = [...presets.filter(p => p.name !== name), { name, filters }];
    savePresets(next);
    setPresets(next);
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
  const handleLoadPreset = (name: string) => {
    const p = presets.find(x => x.name === name);
    if (p) setFilters(p.filters);
  };
  const handleDeletePreset = (name: string) => {
    const next = presets.filter(p => p.name !== name);
    savePresets(next);
    setPresets(next);
  };

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-r border-border bg-[var(--color-surface)] p-5 pb-32 md:pb-5">
      <Section label="Typ obchodu">
        <Select value={filters.deal_type} onChange={(v) => update("deal_type", v as ScanFilters["deal_type"])}
          options={[["prodej", "Prodej"], ["pronajem", "Pronájem"]]} />
      </Section>

      <Section label="Typ nemovitosti">
        <Select value={filters.property_type} onChange={(v) => update("property_type", v as ScanFilters["property_type"])}
          options={[["byty", "Byty"], ["domy", "Domy"], ["pozemky", "Pozemky"], ["komercni", "Komerční"], ["ostatni", "Ostatní (garáže)"]]} />
        {filters.property_type === "ostatni" && (
          <>
            <Label>Podkategorie</Label>
            <Select value={filters.sub_type} onChange={(v) => update("sub_type", v as ScanFilters["sub_type"])}
              options={[["garaz", "Garáž"], ["garazove_stani", "Garážové stání"], ["", "Vše"]]} />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Některé portály nerozlišují – výsledky filtrujeme dodatečně podle názvu.
            </p>
          </>
        )}
      </Section>

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
          <button type="button" onClick={() => update("sources", FAST_KEYS)}
            className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Jen rychlé
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
                <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-primary" : "border-2 border-border"}`} />
                <span className="flex-1 text-foreground">{s.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${badgeClass(s.type)}`}>
                  {s.badge}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          🟠 BROWSER zdroje běží přes Firecrawl (cloud headless prohlížeč) — sken je pomalejší (~10–30 s) a spotřebovává Firecrawl kredity.
        </p>
      </Section>


      <Section label="Zobrazení">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={view.dedupe}
            onChange={(e) => setView({ ...view, dedupe: e.target.checked })}
            className="h-4 w-4 accent-primary" />
          Skrýt duplicity (lokalita + cena)
        </label>
      </Section>


      <Section label="Řazení">
        <Select value={filters.sort_by} onChange={(v) => update("sort_by", v as ScanFilters["sort_by"])}
          options={[["date_desc", "Nejnovější ↓"], ["source", "Dle zdroje"], ["price_asc", "Cena ↑"], ["price_desc", "Cena ↓"], ["yield", "Výnos ↓"]]} />
      </Section>

      <Section label="Presety filtrů">
        <div className="flex gap-1.5">
          <button type="button" onClick={handleSavePreset}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-foreground hover:border-primary/50">
            <Save className="h-3 w-3" /> Lokálně
          </button>
          {isAuthed && (
            <button type="button" onClick={handleSaveCloud}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/50 bg-primary/5 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
              <Cloud className="h-3 w-3" /> Do účtu
            </button>
          )}
        </div>
        {cloudMsg && <p className="text-[10px] text-muted-foreground">{cloudMsg}</p>}
        {presets.length > 0 && (
          <div className="flex flex-col gap-1">
            {presets.map((p) => (
              <div key={p.name} className="flex items-center gap-1">
                <button type="button" onClick={() => handleLoadPreset(p.name)}
                  className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1.5 text-left text-xs text-foreground hover:border-primary/50">
                  <Bookmark className="h-3 w-3 text-primary" /> {p.name}
                </button>
                <button type="button" onClick={() => handleDeletePreset(p.name)}
                  className="rounded-md border border-border bg-[var(--color-surface-2)] p-1.5 text-muted-foreground hover:text-[var(--color-danger)]">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
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
