import type { Diagnostic, ScanMeta } from "@/lib/scanner/types";
import { CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { useState } from "react";

export function DiagnosticsBar({ items, meta }: { items: Diagnostic[]; meta?: ScanMeta }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  const hasIssues = items.some((d) => !d.ok || d.count === 0);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((d) => {
          const Icon = !d.ok ? XCircle : d.count === 0 ? AlertCircle : CheckCircle2;
          const color = !d.ok
            ? "text-[var(--color-danger)] border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5"
            : d.count === 0
            ? "text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5"
            : "text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/5";
          return (
            <div
              key={d.key}
              title={d.error || (d.count === 0 ? "Žádné výsledky" : "OK")}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${color}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{d.source}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {d.count} inz. · {d.ms}ms
              </span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
            hasIssues
              ? "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 text-[var(--color-warning)]"
              : "border-border bg-[var(--color-surface-2)] text-muted-foreground hover:text-foreground"
          }`}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-semibold">Log</span>
        </button>
      </div>

      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-[var(--color-surface-2)]">
          <div className="border-b border-border bg-[var(--color-surface)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Detail skenu
          </div>
          <div className="max-h-72 overflow-y-auto p-3">
            <table className="w-full font-mono text-[11px]">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-1 pr-3">Zdroj</th>
                  <th className="pb-1 pr-3">Stav</th>
                  <th className="pb-1 pr-3">Počet</th>
                  <th className="pb-1 pr-3">Trvání</th>
                  <th className="pb-1">Chyba / poznámka</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.key} className="border-t border-border/50 align-top">
                    <td className="py-1 pr-3 font-semibold text-foreground">{d.source}</td>
                    <td className="py-1 pr-3">
                      {!d.ok ? (
                        <span className="text-[var(--color-danger)]">FAIL</span>
                      ) : d.count === 0 ? (
                        <span className="text-[var(--color-warning)]">EMPTY</span>
                      ) : (
                        <span className="text-[var(--color-success)]">OK</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-foreground">{d.count}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{d.ms} ms</td>
                    <td className="py-1 break-all text-muted-foreground">
                      {d.error ? d.error : d.count === 0 ? "Zdroj nevrátil žádné inzeráty." : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
