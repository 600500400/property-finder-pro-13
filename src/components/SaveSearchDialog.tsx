import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { upsertSavedSearch } from "@/lib/alerts/saved-searches.functions";
import type { ScanFilters } from "@/lib/scanner/types";
import { X, Loader2, Crown } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeModal } from "./UpgradeModal";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ScanFilters;
  defaultName?: string;
}

const REGION_LABEL: Record<string, string> = {
  praha: "Praha", stredocesky: "Středočeský", jihocesky: "Jihočeský",
  jihomoravsky: "Jihomoravský", karlovarsky: "Karlovarský",
  kralovehradecky: "Královéhradecký", liberecky: "Liberecký",
  moravskoslezsky: "Moravskoslezský", olomoucky: "Olomoucký",
  pardubicky: "Pardubický", plzensky: "Plzeňský", ustecky: "Ústecký",
  vysocina: "Vysočina", zlinsky: "Zlínský",
};
const PROP_LABEL: Record<string, string> = {
  byty: "Byty", domy: "Domy", pozemky: "Pozemky", komercni: "Komerční", ostatni: "Ostatní",
};

function suggestName(f: ScanFilters): string {
  const parts: string[] = [];
  parts.push(PROP_LABEL[f.property_type] ?? f.property_type);
  if (f.region) parts.push(REGION_LABEL[f.region] ?? f.region);
  else parts.push("Celá ČR");
  if (f.price_max) parts.push(`do ${(f.price_max / 1_000_000).toFixed(1)} mil.`);
  parts.push(f.deal_type === "prodej" ? "(prodej)" : "(pronájem)");
  return parts.join(" ");
}

export function SaveSearchDialog({ open, onClose, filters, defaultName }: Props) {
  const upsert = useServerFn(upsertSavedSearch);
  const { data: plan } = usePlan();
  const isPremium = plan?.is_premium ?? false;
  const [name, setName] = useState(defaultName ?? suggestName(filters));
  const [frequency, setFrequency] = useState<"instant" | "daily">("daily");
  const [minYield, setMinYield] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await upsert({ data: {
        name: name.trim() || suggestName(filters),
        filters: filters as unknown as Record<string, unknown>,
        min_yield: minYield ? Number(minYield) : null,
        frequency,
        is_active: true,
      }});
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UPGRADE_REQUIRED")) {
        setUpgrade(msg.replace(/.*UPGRADE_REQUIRED:\s*/, ""));
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border bg-[var(--color-surface)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">🐕 Uložit jako hlídacího psa</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Název</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          placeholder={suggestName(filters)}
          maxLength={120}
        />

        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Frekvence upozornění</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setFrequency("daily")}
            className={`rounded-lg border px-3 py-2 text-sm transition ${frequency === "daily" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-[var(--color-surface-2)] text-muted-foreground hover:border-primary/40"}`}>
            <div className="font-semibold">Denní souhrn</div>
            <div className="text-[11px] text-muted-foreground">06:00 ráno</div>
          </button>
          <button type="button" onClick={() => setFrequency("instant")}
            className={`rounded-lg border px-3 py-2 text-sm transition ${frequency === "instant" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-[var(--color-surface-2)] text-muted-foreground hover:border-primary/40"}`}>
            <div className="font-semibold">Okamžitě</div>
            <div className="text-[11px] text-muted-foreground">po každém skenu</div>
          </button>
        </div>

        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Minimální výnos % (volitelné)</label>
        <input
          type="number" min={0} max={50} step={0.5} placeholder="např. 5"
          value={minYield}
          onChange={(e) => setMinYield(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />

        <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90">
          ℹ️ Sandbox: maily zatím odcházejí jen na e-mail majitele Resend účtu. Po ověření domény přijdou na tvou adresu.
        </p>

        {err && <p className="mb-3 text-xs text-[var(--color-danger)]">{err}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm text-foreground hover:border-primary/40">
            Zrušit
          </button>
          <button type="submit" disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-3 w-3 animate-spin" />} Uložit hledání
          </button>
        </div>
      </form>
    </div>
  );
}
