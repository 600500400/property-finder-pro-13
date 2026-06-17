import type { Listing, Flag } from "@/lib/scanner/types";
import { MapPin, ExternalLink, TrendingUp, TrendingDown, Coins, Clock, AlertTriangle } from "lucide-react";
import { AIAnalysisButton } from "./AIAnalysisDialog";

function hasPriceTrap(flags?: Flag[]): boolean {
  return !!flags?.some(f => f.category === "price_trap");
}

function FlagChips({ flags, max = 3 }: { flags?: Flag[]; max?: number }) {
  if (!flags || flags.length === 0) return null;
  const shown = flags.slice(0, max);
  const rest = flags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(f => (
        <span
          key={f.code}
          title={f.snippet || f.label}
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200"
        >
          <AlertTriangle className="h-2.5 w-2.5" /> {f.label}
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200/80">
          +{rest}
        </span>
      )}
    </div>
  );
}

export type Density = "card" | "compact" | "list";

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
  if (badge === "Nové") return "bg-emerald-500 text-white";
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
  if (h <= 24) return "Nové";
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

const OWNERSHIP_LABEL: Record<string, { short: string; full: string; cls: string }> = {
  osobni: {
    short: "OV",
    full: "Osobní vlastnictví",
    cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  },
  druzstevni: {
    short: "DV",
    full: "Družstevní – pozor na anuitu / nesplacený úvěr",
    cls: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
  },
  jine: {
    short: "JINÉ",
    full: "Jiné / neurčeno (státní, obecní, nezjištěno)",
    cls: "bg-muted text-muted-foreground border border-border",
  },
};

function fmtMil(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(".", ",")} mil`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis`;
  return n.toLocaleString("cs-CZ");
}

export function ListingCard({ listing, density = "card" }: { listing: Listing; density?: Density }) {
  if (density === "list") return <ListingRow listing={listing} />;
  if (density === "compact") return <ListingCompact listing={listing} />;
  return <ListingFull listing={listing} />;
}

function ListingFull({ listing }: { listing: Listing }) {
  const inv = listing.invest;
  const fresh = freshnessBadge(listing.published_at);
  const dateText = fmtDate(listing.published_at);
  const isFallbackDate = listing.published_at_source === "fallback_now";
  const ownershipKey = listing.ownership ?? "jine";
  const own = OWNERSHIP_LABEL[ownershipKey] ?? OWNERSHIP_LABEL.jine;
  const anuity = listing.anuity;
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
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {listing.source}
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {anuity?.has_anuity && (
              <span
                title={anuity.source_phrase || "V popisu zmínka o anuitě / nesplaceném úvěru družstva"}
                className="rounded-md border border-red-500/50 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-red-300"
              >
                + ANUITA
              </span>
            )}
            {badges.map((b) => (
              <span key={b} className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${badgeClass(b)}`}>
                {b}
              </span>
            ))}
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{listing.name}</h3>

        <div>
          <span
            title={own.full}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold tracking-wide ${own.cls}`}
          >
            {own.short} <span className="font-normal opacity-80">· {own.full.split(" ").slice(0, 2).join(" ")}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {listing.locality && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{listing.locality}</span>
            </span>
          )}
        </div>

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

        {anuity?.has_anuity && (
          <div
            className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[10px] leading-snug text-red-200"
            title={anuity.source_phrase || undefined}
          >
            <div className="font-semibold uppercase tracking-wider text-red-300">
              Pozor: anuita / nesplacený úvěr
            </div>
            {anuity.amount && listing.price ? (
              <div className="mt-0.5 font-mono">
                {fmtMil(listing.price)} + {fmtMil(anuity.amount)} = <span className="font-bold">{fmtMil(anuity.effective_price || listing.price + anuity.amount)} Kč efektivně</span>
              </div>
            ) : (
              <div className="mt-0.5 text-red-200/80">
                {anuity.confidence === "medium" ? "Družstevní byt – ověř výši anuity v inzerátu." : "Částka nebyla v popisu nalezena."}
              </div>
            )}
          </div>
        )}
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
            {anuity?.effective_price && (
              <div className="mt-1 text-[10px] font-semibold text-red-300">
                ⚠ Výnos přepočten z efektivní ceny vč. anuity
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

function ListingCompact({ listing }: { listing: Listing }) {
  const inv = listing.invest;
  const ownershipKey = listing.ownership ?? "jine";
  const own = OWNERSHIP_LABEL[ownershipKey] ?? OWNERSHIP_LABEL.jine;
  const fresh = freshnessBadge(listing.published_at);
  const isFallbackDate = listing.published_at_source === "fallback_now";
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 transition hover:border-primary/50"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
          {listing.source}
        </span>
        {listing.anuity?.has_anuity && (
          <span className="rounded-sm border border-red-500/50 bg-red-500/15 px-1 py-0.5 text-[8px] font-bold text-red-300">
            +ANUITA
          </span>
        )}
        {fresh && !isFallbackDate && (
          <span className={`rounded-sm px-1 py-0.5 text-[8px] font-bold ${badgeClass(fresh)}`}>{fresh}</span>
        )}
      </div>
      <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">{listing.name}</h3>
      <span
        title={own.full}
        className={`inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${own.cls}`}
      >
        {own.short}
      </span>
      {listing.locality && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{listing.locality}</span>
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-1 pt-1">
        <span className="font-mono text-sm font-bold leading-tight text-primary">{listing.price_text}</span>
        {listing.area && (
          <span className="font-mono text-[10px] text-muted-foreground">{listing.area}</span>
        )}
      </div>
      {inv && (
        <div className={`flex items-center justify-between rounded-sm border px-1.5 py-1 text-[10px] ${verdictBg(inv.stars)}`}>
          <span className={`font-mono font-semibold ${yieldClass(inv.stars)}`}>{inv.net_yield}% čistý</span>
          <span className={`font-mono tracking-wider ${yieldClass(inv.stars)}`}>
            {"★".repeat(inv.stars)}
          </span>
        </div>
      )}
    </a>
  );
}

function ListingRow({ listing }: { listing: Listing }) {
  const inv = listing.invest;
  const ownershipKey = listing.ownership ?? "jine";
  const own = OWNERSHIP_LABEL[ownershipKey] ?? OWNERSHIP_LABEL.jine;
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 border-b border-border bg-card px-3 py-2 transition hover:bg-muted/30"
    >
      {listing.img ? (
        <img
          src={listing.img}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-md bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="rounded-sm bg-primary/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-primary">
            {listing.source}
          </span>
          <span
            title={own.full}
            className={`rounded-sm px-1.5 py-0 text-[10px] font-bold ${own.cls}`}
          >
            {own.short}
          </span>
          {listing.anuity?.has_anuity && (
            <span className="rounded-sm border border-red-500/50 bg-red-500/15 px-1 py-0 text-[9px] font-bold text-red-300">
              +ANUITA
            </span>
          )}
        </div>
        <h3 className="truncate text-xs font-semibold text-foreground">{listing.name}</h3>
        {listing.locality && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{listing.locality}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-sm font-bold text-primary">{listing.price_text}</span>
        {inv && (
          <span className={`font-mono text-[10px] font-semibold ${yieldClass(inv.stars)}`}>
            {inv.net_yield}% · {"★".repeat(inv.stars)}
          </span>
        )}
      </div>
    </a>
  );
}
