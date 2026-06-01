import type { Diagnostic } from "@/lib/scanner/types";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export function DiagnosticsBar({ items }: { items: Diagnostic[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
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
    </div>
  );
}
