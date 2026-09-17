import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type { Listing } from "@/lib/scanner/types";
import { usePlan } from "@/hooks/usePlan";
import {
  listSavedListings,
  saveListing,
  unsaveListing,
} from "@/lib/saved-listings/saved-listings.functions";

export function SaveBookmarkButton({ listing }: { listing: Listing }) {
  const { data: plan } = usePlan();
  const tier = plan?.tier ?? "anonymous";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listSavedListings);
  const saveFn = useServerFn(saveListing);
  const unsaveFn = useServerFn(unsaveListing);

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => listFn(),
    enabled: tier !== "anonymous",
    staleTime: 30_000,
  });

  const isSaved = saved.some((s) => s.listing_url === listing.url);

  const mut = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await unsaveFn({ data: { listing_url: listing.url } });
      } else {
        await saveFn({
          data: {
            listing_url: listing.url,
            source: listing.source,
            name: listing.name,
            locality: listing.locality,
            price: listing.price ?? null,
            area_m2: listing.area_m2 ?? null,
            image_url: listing.img ?? undefined,
          },
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-listings"] }),
    onSettled: () => setBusy(false),
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (tier === "anonymous") {
      navigate({ to: "/auth", search: { next: window.location.pathname + window.location.search } });
      return;
    }
    setBusy(true);
    mut.mutate();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={
        tier === "anonymous"
          ? "Přihlaste se pro uložení inzerátu"
          : isSaved
          ? "Odebrat z oblíbených"
          : "Uložit do oblíbených"
      }
      className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition whitespace-nowrap ${
        isSaved
          ? "border-primary/60 bg-primary/15 text-primary hover:bg-primary/25"
          : "border-border bg-[var(--color-surface-2)] text-muted-foreground hover:text-foreground"
      } disabled:opacity-50`}
    >
      {isSaved ? <BookmarkCheck className="h-3 w-3 shrink-0" /> : <Bookmark className="h-3 w-3 shrink-0" />}
      <span>{isSaved ? "Uloženo" : "Uložit"}</span>
    </button>
  );
}
