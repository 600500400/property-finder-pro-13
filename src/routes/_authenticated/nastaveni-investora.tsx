import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import { getMyInvestorRules, saveMyInvestorRules } from "@/lib/listings/investor-rules.functions";

export const Route = createFileRoute("/_authenticated/nastaveni-investora")({
  head: () => ({ meta: [{ title: "Nastavení investora — RealityScanner" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getRules = useServerFn(getMyInvestorRules);
  const saveRules = useServerFn(saveMyInvestorRules);

  const q = useQuery({ queryKey: ["investor_rules"], queryFn: () => getRules() });

  const [localities, setLocalities] = useState("");
  const [minYield, setMinYield] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [requireOsobni, setRequireOsobni] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.data) {
      setLocalities(q.data.excluded_localities.join("\n"));
      setMinYield(q.data.min_net_yield != null ? String(q.data.min_net_yield) : "");
      setMaxPrice(q.data.max_price != null ? String(q.data.max_price) : "");
      setRequireOsobni(q.data.require_osobni);
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () => saveRules({ data: {
      excluded_localities: localities.split("\n").map(s => s.trim()).filter(Boolean),
      min_net_yield: minYield.trim() === "" ? null : Number(minYield.replace(",", ".")),
      max_price: maxPrice.trim() === "" ? null : Number(maxPrice.replace(/\s/g, "")),
      require_osobni: requireOsobni,
    } }),
    onSuccess: () => {
      setMsg("Uloženo ✓");
      qc.invalidateQueries({ queryKey: ["investor_rules"] });
      setTimeout(() => setMsg(null), 2500);
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[var(--color-surface)] px-5 py-3">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Scanner
        </Link>
        <h1 className="text-base font-bold">Nastavení investora</h1>
      </header>

      <main className="mx-auto max-w-2xl p-5">
        <p className="mb-5 text-xs text-muted-foreground">
          Tato pravidla se promítnou do AI investiční analýzy. AI bude flagovat inzeráty, které je porušují.
        </p>

        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

        {q.data && (
          <form
            onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }}
            className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vyloučené lokality
              </label>
              <textarea
                value={localities}
                onChange={(e) => setLocalities(e.target.value)}
                rows={6}
                placeholder={"Most\nChánov\nLitvínov-Janov\n…"}
                className="w-full rounded-md border border-border bg-[var(--color-surface-2)] px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Jedna lokalita na řádek. Substring match (např. „Most" pokryje „Most-Stovky").
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Minimální čistý výnos (%)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={minYield}
                  onChange={(e) => setMinYield(e.target.value)}
                  placeholder="např. 4.5"
                  className="w-full rounded-md border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Maximální cena (Kč)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="např. 6000000"
                  className="w-full rounded-md border border-border bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireOsobni}
                onChange={(e) => setRequireOsobni(e.target.checked)}
                className="h-4 w-4"
              />
              Pouze osobní vlastnictví (vyhnout se družstevním)
            </label>

            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={saveM.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Uložit
              </button>
              {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
