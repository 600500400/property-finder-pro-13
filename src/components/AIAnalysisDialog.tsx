import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Listing } from "@/lib/scanner/types";
import { analyzeListing, type AIAnalysis } from "@/lib/ai/analyze.functions";
import { Loader2, Sparkles, X, AlertTriangle } from "lucide-react";

export function AIAnalysisButton({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25"
      >
        <Sparkles className="h-3 w-3" /> AI analýza
      </button>
      {open && <Dialog listing={listing} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const analyze = useServerFn(analyzeListing);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIAnalysis | null>(null);

  useState(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await analyze({
          data: {
            source: listing.source,
            name: listing.name,
            locality: listing.locality,
            url: listing.url,
            price: listing.price,
            area_m2: listing.area_m2,
            ownership: listing.ownership,
            rent_basis_label: listing.invest?.rent_basis_label,
            net_yield: listing.invest?.net_yield,
            gross_yield: listing.invest?.gross_yield,
          },
        });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">AI investiční analýza</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 line-clamp-1 text-xs text-muted-foreground">{listing.name} — {listing.locality}</p>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">AI analyzuje lokalitu, rizika a výnos…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 text-xs text-[var(--color-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skóre</span>
              <span className="font-mono text-lg font-bold text-primary">{data.score}/10</span>
            </div>
            <Section title="Lokalita">{data.lokalita}</Section>
            {data.rizika.length > 0 && (
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rizika</h4>
                <ul className="ml-4 list-disc space-y-0.5 text-xs">
                  {data.rizika.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            <Section title="Sociodemografie">{data.sociodemo}</Section>
            <Section title="Doporučení">{data.doporuceni}</Section>
            {data.cached && data.cached_at && (
              <p className="text-[10px] italic text-muted-foreground">
                Z cache (uloženo {new Date(data.cached_at).toLocaleDateString("cs-CZ")}). AI analýzy se ukládají na 30 dní.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <p className="text-xs leading-relaxed text-foreground">{children}</p>
    </div>
  );
}
