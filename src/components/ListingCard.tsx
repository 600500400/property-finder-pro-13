import type { Listing } from "@/lib/scanner/types";
import { MapPin, ExternalLink, TrendingUp, TrendingDown, Coins, Clock } from "lucide-react";

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
  if (badge === "TOP") return "bg-amber-500/90 text-black";
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

function relativeDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "dnes";
  if (days === 1) return "včera";
  if (days < 31) return `před ${days} dny`;
  const mo = Math.floor(days / 30);
  return `před ${mo} měs.`;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const inv = listing.invest;
  const fresh = freshnessBadge(listing.published_at);
  const rel = relativeDate(listing.published_at);
  const badges = [
    ...(fresh ? [fresh] : []),
    ...(listing.badges || []).filter(b => b !== "NOVÝ" || !fresh),
  ];
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-surface-2)]">
        {listing.img ? (
          <img
            src={listing.img}
            alt={listing.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-border">🏠</div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
          {listing.source}
        </span>
        {badges.length > 0 && (
          <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
            {badges.map((b) => (
              <span key={b} className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider shadow ${badgeClass(b)}`}>
                {b}
              </span>
            ))}
          </div>
        )}
        <ExternalLink className="absolute bottom-2 right-2 h-4 w-4 text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{listing.name}</h3>
        {listing.locality && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{listing.locality}</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <span className="font-mono text-lg font-bold text-primary">{listing.price_text}</span>
          {rel && <span className="text-[10px] text-muted-foreground">{rel}</span>}
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
          </div>
        </div>
      )}
    </a>
  );
}
