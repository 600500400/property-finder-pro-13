import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getAdminDashboard, type AdminUserRow } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type SortKey = "email" | "created_at" | "last_sign_in_at" | "plan" | "watchdogs" | "ai_analyses_month";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("cs-CZ");
}

function AdminPage() {
  const fetchFn = useServerFn(getAdminDashboard);
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchFn(),
    refetchInterval: 120_000,
  });

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const sortedUsers = useMemo(() => {
    if (!data) return [];
    const filtered = search
      ? data.users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
      : data.users;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortKey, sortDir, search]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageUsers = sortedUsers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "email" ? "asc" : "desc");
    }
    setPage(0);
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Načítám…</div>;
  }
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/forbidden/i.test(msg)) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-2">403 — Pouze pro administrátory</h1>
          <button className="text-sm underline" onClick={() => router.navigate({ to: "/" })}>
            Zpět
          </button>
        </div>
      );
    }
    return <div className="p-6 text-sm text-[var(--color-danger)]">Chyba: {msg}</div>;
  }
  if (!data) return null;

  const { totals, activity_30d } = data;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">Provozní přehled uživatelů a aktivity.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
          disabled={isFetching}
        >
          {isFetching ? "…" : "Obnovit"}
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Registrovaní uživatelé" value={totals.users.toLocaleString("cs-CZ")} />
        <SummaryCard label="Platící (Premium)" value={totals.premium.toLocaleString("cs-CZ")} />
        <SummaryCard label="Free" value={totals.free.toLocaleString("cs-CZ")} />
        <SummaryCard
          label="Konverzní poměr"
          value={`${totals.conversion_pct.toLocaleString("cs-CZ")} %`}
          accent
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aktivita za posledních 30 dní
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard label="Aktivní hlídací psi (celkem)" value={activity_30d.active_watchdogs.toLocaleString("cs-CZ")} />
          <SummaryCard label="Odeslaných alertů" value={activity_30d.alerts_sent.toLocaleString("cs-CZ")} />
          <SummaryCard label="AI analýz" value={activity_30d.ai_analyses.toLocaleString("cs-CZ")} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Uživatelé ({sortedUsers.length.toLocaleString("cs-CZ")})
          </h2>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Hledat e-mail…"
            className="w-64 rounded-md border border-border bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent,#5fd6ad)]"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th label="E-mail" k="email" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <Th label="Registrace" k="created_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <Th label="Poslední přihlášení" k="last_sign_in_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <Th label="Plán" k="plan" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <Th label="Hlídací psi" k="watchdogs" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <Th label="AI analýz (měsíc)" k="ai_analyses_month" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {pageUsers.map((u) => (
                <UserRow key={u.id} u={u} />
              ))}
              {pageUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Žádní uživatelé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Strana {currentPage + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              ← Předchozí
            </button>
            <button
              className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Další →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${accent ? "text-[var(--color-accent,#5fd6ad)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function UserRow({ u }: { u: AdminUserRow }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-medium">{u.email || "—"}</td>
      <td className="px-3 py-2 text-muted-foreground">{fmt(u.created_at)}</td>
      <td className="px-3 py-2 text-muted-foreground">{fmt(u.last_sign_in_at)}</td>
      <td className="px-3 py-2">
        {u.plan === "premium" ? (
          <span className="inline-flex items-center rounded-full bg-[var(--color-accent,#5fd6ad)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-accent,#5fd6ad)]">
            Premium
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-muted-foreground">
            Free
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">{u.watchdogs}</td>
      <td className="px-3 py-2 text-right font-mono">{u.ai_analyses_month}</td>
    </tr>
  );
}
