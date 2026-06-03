import type { Listing } from "@/lib/scanner/types";
import { MapPin, ExternalLink, TrendingUp, TrendingDown, Coins, Clock } from "lucide-react";
import { AIAnalysisButton } from "./AIAnalysisDialog";

function yieldClass(stars: number | undefined): string {
  switch (stars) {
    case 5: return "text-[var(--color-success)]";
    case 4: return "text-emerald-300";
    case 3: return "text-[var(--color-warning)]";
    case 2: return "text-orange-400";
    case 1: return "text-[var(--color-danger)]";
    default: return "text-muted-foreground";
  }
}

function verdictBg(stars: number | undefined): string {
  switch (stars) {
    case 5: return "bg-emerald-500/10 border-emerald-500/30";
    case 4: return "bg-emerald-500/10 border-emerald-400/20";
    case 3: return "bg-amber-500/10 border-amber-500/30";
    case 2: return "bg-orange-500/10 border-orange-500/30";
    case 1: return "bg-red-500/10 border-red-500/30";
    default: return "bg-muted/30 border-border";
  }
}

function badgeClass(badge: string): string {
  if (badge === "Placené") return "bg-muted text-muted-foreground border border-border";
  if (badge === "HOT 🔥") return "bg-red-500 text-white";
  if (badge === "NOVÝ" || badge === "NEW") return "bg-primary text-primary-foreground";
  if (badge === "Tento týden") return "bg-sky-500/80 text-white";
  return "bg-background/80 text-foreground";
}

function freshnessBadge(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const h = (Date.now() - t) / 3_600_000;
  if (h < 0) return null;
  if (h <= 24) return "HOT 🔥";
  if (h <= 72) return "NOVÝ";
  if (h <= 24 * 7) return "Tento týden";
  return null;
}

function fmtDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

const OWNERSHIP_LABEL: Record<string, { short: string; full: string }> = {
  osobni: { short: "OV", full: "Osobní vlastnictví" },
  druzstevni: { short: "DV", full: "Družstevní" },
  statni: { short: "ST", full: "Státní/obecní" },
  jine: { short: "?", full: "Jiné" },
};

export function ListingCard({ listing }: { listing: Listing }) {
  const inv = listing.invest;
  const fresh = freshnessBadge(listing.published_at);
  const dateText = fmtDate(listing.published_at);
  const isFallbackDate = listing.published_at_source === "fallback_now";
  const own = listing.ownership ? OWNERSHIP_LABEL[listing.ownership] : null;
  const badges = [
    ...(fresh && !isFallbackDate ? [fresh] : []),
    ...(listing.badges || []).filter(b => b !== "NOVÝ" || !fresh),
  ];
  const pricePerM2 = listing.price && listing.area_m2 ? Math.round(listing.price / listing.area_m2) : null;
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Header: source + badges */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {listing.source}
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {badges.map((b) => (
              <span key={b} className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${badgeClass(b)}`}>
                {b}
              </span>
            ))}
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{listing.name}</h3>

        {/* Locality + ownership */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {listing.locality && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{listing.locality}</span>
            </span>
          )}
          {own && (
            <span
              title={own.full}
              className="ml-auto shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground"
            >
              {own.short}
            </span>
          )}
        </div>

        {/* Price + area + Kč/m² */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col">
            <span className="font-mono text-lg font-bold text-primary leading-tight">{listing.price_text}</span>
            {pricePerM2 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {pricePerM2.toLocaleString("cs-CZ")} Kč/m²
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {listing.area && (
              <span className="font-mono text-xs font-semibold text-foreground">{listing.area}</span>
            )}
            {dateText && (
              <span
                title={isFallbackDate ? "Datum nebylo k dispozici — zobrazen čas skenu" : "Datum zveřejnění"}
                className={`text-[10px] ${isFallbackDate ? "italic text-muted-foreground/60" : "text-muted-foreground"}`}
              >
                {isFallbackDate ? `~ ${dateText}` : dateText}
              </span>
            )}
          </div>
        </div>
      </div>

      {inv && (
        <div className={`grid grid-cols-2 gap-2 border-t border-border p-3 ${verdictBg(inv.stars)}`}>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Hrubý výnos
            </span>
            <span className={`font-mono text-sm font-semibold ${yieldClass(inv.stars)}`}>{inv.gross_yield}%</span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <TrendingDown className="h-3 w-3" /> Čistý výnos
            </span>
            <span className={`font-mono text-sm font-semibold ${yieldClass(inv.stars)}`}>{inv.net_yield}%</span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Coins className="h-3 w-3" /> Nájemné/měs.
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {inv.monthly_rent.toLocaleString("cs-CZ")} Kč
            </span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" /> Návratnost
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">{inv.payback_years} let</span>
          </div>
          <div className="col-span-2 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest text-primary">
                {"★".repeat(inv.stars)}{"☆".repeat(5 - inv.stars)}
              </span>
              <span className={`text-xs font-semibold ${yieldClass(inv.stars)}`}>{inv.verdict}</span>
            </div>
            {inv.rent_basis_label && (
              <div
                className="mt-1 text-[10px] text-muted-foreground"
                title={
                  inv.rent_source === "okres_live" ? "Živá tržní data ze Sreality (medián per okres)" :
                  inv.rent_source === "okres_static" ? "Statický odhad okresu (Deloitte / ČSÚ)" :
                  inv.rent_source === "district" ? "Konkrétní městská část" :
                  inv.rent_source === "region" ? "Krajský průměr" :
                  "Národní průměr — orientační"
                }
              >
                Odhad nájmu: {inv.rent_basis_label}
                {inv.rent_source === "okres_live" ? " ✓" :
                 inv.rent_source === "district" ? " ✓" :
                 inv.rent_source === "okres_static" ? " ~" :
                 inv.rent_source === "region" ? " (kraj)" : " (ČR)"}
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <AIAnalysisButton listing={listing} />
            </div>
          </div>
        </div>
      )}
    </a>
  );
}

