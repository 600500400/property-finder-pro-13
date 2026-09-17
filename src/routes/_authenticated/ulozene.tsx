import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, MapPin, Trash2, ExternalLink } from "lucide-react";
import {
  listSavedListings,
  unsaveListing,
} from "@/lib/saved-listings/saved-listings.functions";

export const Route = createFileRoute("/_authenticated/ulozene")({
  staticData: { sitemap: false },
  component: SavedPage,
  head: () => ({ meta: [{ title: "Uložené inzeráty · RealityScanner" }] }),
});

function SavedPage() {
  const listFn = useServerFn(listSavedListings);
  const unsaveFn = useServerFn(unsaveListing);
  const qc = useQueryClient();

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => listFn(),
  });

  const remove = useMutation({
    mutationFn: (url: string) => unsaveFn({ data: { listing_url: url } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-listings"] }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)] px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Bookmark className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-base font-bold">Uložené inzeráty</h1>
            <p className="text-[11px] text-muted-foreground">Tvoje oblíbené nemovitosti napříč portály.</p>
          </div>
          <Link to="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground">← Zpět na hledání</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        {isLoading && <p className="text-sm text-muted-foreground">Načítám…</p>}

        {!isLoading && saved.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Bookmark className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Zatím nemáš nic uloženého.</p>
            <Link to="/" className="mt-3 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
              Procházet inzeráty
            </Link>
          </div>
        )}

        {saved.length > 0 && (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                {s.image_url ? (
                  <img src={s.image_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{s.source ?? "—"}</span>
                    <span>·</span>
                    <span>{new Date(s.created_at).toLocaleDateString("cs-CZ")}</span>
                  </div>
                  <a
                    href={s.listing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-1 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {s.name ?? s.listing_url}
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {s.locality && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.locality}
                      </span>
                    )}
                    {s.price && (
                      <span className="font-mono font-semibold text-primary">
                        {Number(s.price).toLocaleString("cs-CZ")} Kč
                      </span>
                    )}
                    {s.area_m2 && <span>{s.area_m2} m²</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(s.listing_url)}
                  className="rounded-md border border-border p-2 text-muted-foreground hover:border-red-500/40 hover:text-red-300"
                  title="Odebrat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
