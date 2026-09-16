import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import type { Listing } from "@/lib/scanner/types";
import { analyzeListing, type AIAnalysisResult } from "@/lib/ai/analyze.functions";
import { usePlan } from "@/hooks/usePlan";
import { Loader2, Sparkles, X, AlertTriangle, Crown, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

export function AIAnalysisButton({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const { data: plan } = usePlan();
  const tier = plan?.tier ?? "anonymous";
  const isPremium = tier === "premium";
  const sampleUsed = !!plan?.free_ai_sample_used;

  const navigate = useNavigate();

  // Anonymous: needs to register first
  if (tier === "anonymous") {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate({ to: "/auth" }); }}
        title="Pro AI analýzu se zaregistrujte — získáte jednu zdarma na vyzkoušení"
        className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
      >
        <Sparkles className="h-3 w-3" /> AI analýza (zdarma po registraci)
      </button>
    );
  }

  // Free user who already spent the sample: push Premium
  if (!isPremium && sampleUsed) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate({ to: "/cenik" }); }}
        title="Volnou AI analýzu jste již vyčerpali — Premium = 50/měsíc"
        className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
      >
        <Crown className="h-3 w-3" /> AI analýza (Premium)
      </button>
    );
  }

  // Stored listings always carry an id; without it the quota reservation cannot run.
  if (!listing.id) {
    return (
      <button
        type="button"
        disabled
        title="AI analýza není pro tento inzerát dostupná"
        className="flex cursor-not-allowed items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground opacity-60"
      >
        <Sparkles className="h-3 w-3" /> AI analýza
      </button>
    );
  }

  // Free user with sample available, OR premium → open dialog
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25"
      >
        <Sparkles className="h-3 w-3" />
        {isPremium ? "AI analýza" : "AI analýza (ukázka zdarma)"}
      </button>
      {open && <Dialog listing={listing} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const analyze = useServerFn(analyzeListing);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIAnalysisResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only the listing id travels to the server; every fact is loaded there.
        const res = await analyze({ data: { listing_id: listing.id! } });
        if (!cancelled) {
          setData(res);
          // Refresh plan so the "free sample used" flag flips immediately for free users
          if (res.ok || (res as { error?: string }).error === "free_sample_used") {
            qc.invalidateQueries({ queryKey: ["my-plan"] });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analyze, listing, qc]);

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
            <span className="text-xs">AI vyhodnocuje cenu, výnos a rizika…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 text-xs text-[var(--color-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {data && data.ok === false && data.error === "premium_required" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-center">
            <Crown className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold">AI investiční analýza je Premium funkce.</p>
            <Link to="/cenik" className="rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400">
              Odemknout v Premium
            </Link>
          </div>
        )}

        {data && data.ok === false && data.error === "free_sample_used" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-center">
            <Crown className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold">Volnou ukázkovou AI analýzu jste již vyčerpali.</p>
            <p className="text-xs text-muted-foreground">{data.message}</p>
            <Link to="/cenik" className="rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400">
              Odemknout Premium · 50 analýz/měs.
            </Link>
          </div>
        )}

        {data && data.ok === false && data.error === "monthly_limit_reached" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-amber-200">
            <p className="font-semibold">Měsíční limit AI analýz vyčerpán</p>
            <p className="mt-1">{data.message}</p>
          </div>
        )}

        {data && data.ok === false && data.error === "ai_failed" && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 text-xs text-[var(--color-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {data.message}
          </div>
        )}

        {data && data.ok === true && <Verdict data={data} />}
      </div>
    </div>
  );
}

function Verdict({ data }: { data: Extract<AIAnalysisResult, { ok: true }> }) {
  const v = data.verdict;
  const cfg = v === "zvazit"
    ? { label: "Zvážit", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", Icon: CheckCircle2 }
    : v === "opatrne"
    ? { label: "Opatrně", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300", Icon: ShieldAlert }
    : { label: "Vyhnout se", cls: "border-red-500/40 bg-red-500/10 text-red-300", Icon: XCircle };
  const Icon = cfg.Icon;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${cfg.cls}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Verdikt</span>
        </div>
        <span className="text-lg font-bold">{cfg.label}</span>
      </div>

      {data.price_position && (
        <Section title="Cena vs. srovnatelné">
          <span className={data.price_position.pct_vs_median < 0 ? "text-emerald-300" : data.price_position.pct_vs_median > 10 ? "text-red-300" : "text-amber-300"}>
            {data.price_position.label}
          </span>
        </Section>
      )}

      {data.true_cost_estimate && (
        <Section title="Odhad skutečné akviziční ceny">
          <span className="font-mono">{data.true_cost_estimate.toLocaleString("cs-CZ")} Kč</span>
        </Section>
      )}

      {data.yield_check && <Section title="Kontrola výnosu">{data.yield_check}</Section>}

      {data.risks.length > 0 && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rizika</h4>
          <ul className="ml-4 list-disc space-y-0.5 text-xs">
            {data.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {data.uncertainties.length > 0 && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nejistoty</h4>
          <ul className="ml-4 list-disc space-y-0.5 text-xs">
            {data.uncertainties.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {data.broker_questions.length > 0 && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Otázky na makléře</h4>
          <ul className="ml-4 list-disc space-y-0.5 text-xs">
            {data.broker_questions.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}



      {data.user_rule_violations.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2.5">
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-300">Porušuje vaše pravidla</h4>
          <ul className="ml-4 list-disc space-y-0.5 text-xs text-red-200">
            {data.user_rule_violations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {data.summary_cs && <Section title="Doporučení">{data.summary_cs}</Section>}

      <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span>
          {data.cached
            ? `Z cache (${data.cached_at ? new Date(data.cached_at).toLocaleDateString("cs-CZ") : ""})`
            : data.usage ? `Měsíční využití: ${data.usage.used}/${data.usage.limit}` : ""}
        </span>
        <Link to="/nastaveni-investora" className="text-primary hover:underline">Upravit má pravidla</Link>
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
