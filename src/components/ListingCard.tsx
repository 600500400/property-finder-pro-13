import type { Listing, Flag } from "@/lib/scanner/types";
import { MapPin, ExternalLink, AlertTriangle } from "lucide-react";
import { AIAnalysisButton } from "./AIAnalysisDialog";
import { SaveBookmarkButton } from "./SaveBookmarkButton";

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

/** Tier z hvězdiček → barevný režim verdict-bloku (prototype tier-great/good/mid/poor) */
type Tier = "great" | "good" | "mid" | "poor";
function tierOf(stars: number | undefined): Tier {
  if (!stars) return "poor";
  if (stars >= 5) return "great";
  if (stars === 4) return "good";
  if (stars === 3) return "mid";
  return "poor";
}

const TIER_VERDICT: Record<Tier, string> = {
  great: "border-t border-emerald-400/30 bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.04]",
  good: "border-t border-emerald-400/20 bg-gradient-to-b from-emerald-500/10 to-emerald-500/[0.03]",
  mid: "border-t border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-amber-500/[0.03]",
  poor: "border-t border-red-400/25 bg-gradient-to-b from-red-500/10 to-red-500/[0.03]",
};

const TIER_YIELD: Record<Tier, string> = {
  great: "text-emerald-300",
  good: "text-emerald-300",
  mid: "text-amber-300",
  poor: "text-red-300",
};

const TIER_STARS: Record<Tier, string> = {
  great: "text-emerald-300",
  good: "text-emerald-300",
  mid: "text-amber-300",
  poor: "text-red-300",
};

/** Source-dot barva (z prototypu cards.jsx) */
function sourceDotColor(source: string): string {
  switch (source) {
    case "Sreality": return "var(--color-primary)";
    case "Bezrealitky": return "#7aa2ff";
    case "Bazoš": return "#e0a64b";
    case "iDnes Reality": return "#d06bd0";
    default: return "var(--color-muted-foreground)";
  }
}

function badgeClass(badge: string): string {
  if (badge === "Placené") return "bg-muted text-muted-foreground border border-border";
  if (badge === "HOT 🔥" || badge === "HOT") return "bg-red-500 text-white";
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
    short: "—",
    full: "Jiné / neurčeno (státní, obecní, nezjištěno)",
    cls: "bg-muted text-muted-foreground border border-border",
  },
};

function fmtMil(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(".", ",")} mil`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis`;
  return n.toLocaleString("cs-CZ");
}

function Stars({ n, cls }: { n: number; cls: string }) {
  const safe = Math.max(0, Math.min(5, n || 0));
  return (
    <span className={`font-mono text-xs tracking-[0.2em] ${cls}`} aria-label={`${safe} z 5`}>
      <span>{"★".repeat(safe)}</span>
      <span className="opacity-25">{"★".repeat(5 - safe)}</span>
    </span>
  );
}

/* ---------- Cena/m² vs. průměr srovnatelných ---------- */

const PC_BLOCK: Record<string, string> = {
  below: "border-t border-emerald-400/30 bg-gradient-to-b from-emerald-500/12 to-emerald-500/[0.03]",
  avg: "border-t border-border bg-[var(--color-surface-2)]/40",
  above: "border-t border-red-400/25 bg-gradient-to-b from-red-500/10 to-red-500/[0.03]",
  none: "border-t border-border bg-[var(--color-surface-2)]/30",
};

const PC_TEXT: Record<string, string> = {
  below: "text-emerald-300",
  avg: "text-muted-foreground",
  above: "text-red-300",
};

const PC_LABEL: Record<string, string> = {
  below: "levnější než průměr",
  avg: "v průměru",
  above: "dražší než průměr",
};

function pcScope(scope: string): string {
  return scope === "okres" ? "okres" : scope === "kraj" ? "kraj" : "celá ČR";
}

/** Geographic level of the median — okres is a far stronger signal than kraj. */
function pcScopeMedian(scope: string): string {
  return scope === "okres" ? "medián okresu" : scope === "kraj" ? "medián kraje" : "medián ČR";
}

function pcVs(pc: { diff_pct: number; scope: string; samples: number }): string {
  return `${pcDiff(pc.diff_pct)} vs. ${pcScopeMedian(pc.scope)} (n=${pc.samples})`;
}

function pcDiff(diff: number): string {
  if (diff === 0) return "0 %";
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} %`;
}

const HOUSE_COMPARISON_WARNING = "Srovnání je orientační — málo srovnatelných domů v okolí (často se porovnává s domy ve městech i na vesnici).";
const CSU_CAVEAT = "ČSÚ uvádí ceny, za které se domy skutečně prodaly. Inzerát uvádí nabídkovou cenu, která bývá systematicky vyšší. Kladná odchylka proto sama o sobě neznamená předražení.";

function isWeakHouseComparison(pc: NonNullable<Listing["price_compare"]>): boolean {
  return pc.scope === "kraj" || pc.samples < 10;
}

function PriceCompareHero({ pc }: { pc?: Listing["price_compare"] }) {
  if (!pc) {
    return (
      <div className="flex flex-col leading-none">
        <span className="font-mono text-lg font-bold text-muted-foreground">nedostatek dat pro srovnání</span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          cena/m² vs. průměr
        </span>
      </div>
    );
  }
  const weak = isWeakHouseComparison(pc);
  return (
    <div className={`flex flex-col gap-2 ${weak ? "text-muted-foreground" : ""}`} title={weak ? HOUSE_COMPARISON_WARNING : undefined}>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col leading-none">
          <span className={`inline-flex items-center gap-1.5 font-mono text-3xl font-bold ${weak ? "text-muted-foreground" : PC_TEXT[pc.band]}`}>
            {weak && <AlertTriangle className="h-4 w-4 shrink-0" aria-label="Orientační srovnání" />}
            {pcDiff(pc.diff_pct)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            cena/m² vs. {pcScopeMedian(pc.scope)} (n={pc.samples})
          </span>
        </div>
        <span className={`text-[11px] font-semibold ${weak ? "text-muted-foreground" : PC_TEXT[pc.band]}`}>{PC_LABEL[pc.band]}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2">
        <Metric label="Tato nabídka" value={`${pc.own_per_m2.toLocaleString("cs-CZ")} Kč/m²`} />
        <Metric label="Medián srovnatelných" value={`${pc.median_per_m2.toLocaleString("cs-CZ")} Kč/m²`} />
      </div>
      <div className="text-[10px] text-muted-foreground">
        Medián z {pc.samples} srovnatelných ({pcScope(pc.scope)}, plocha ±25 %)
      </div>
    </div>
  );
}

function csuTooltip(csu: NonNullable<Listing["csu_compare"]>): string {
  const units = ` Naše hodnota je ${csu.own_per_m2.toLocaleString("cs-CZ")} Kč/m² užitné plochy, ČSÚ uvádí ${csu.benchmark_per_m2.toLocaleString("cs-CZ")} Kč/m² obytné plochy — nejde o stejnou jednotku.`;
  const band = ` Srovnáváme jen v pásmu ${csu.size_band_label}${csu.band_factor ? `, přepočtový koeficient ${csu.band_factor.toFixed(2)}` : ""}${csu.band_sample_count ? ` (z ${csu.band_sample_count} domů)` : ""}; očekávaná úroveň pro toto pásmo je ${csu.expected_per_m2.toLocaleString("cs-CZ")} Kč/m².`;
  const estimate = " Koeficient je odvozen z našich vlastních nabídkových cen, výsledná úroveň je proto odhad, ne měření.";
  const area = csu.area_warning && csu.band_typical_area_m2
    ? ` Plocha domu se výrazně liší od typické velikosti v tomto pásmu (${Math.round(csu.band_typical_area_m2)} m²).`
    : "";
  const lowConf = csu.area_low_confidence ? " Plocha u tohoto inzerátu má nízkou důvěryhodnost (není strukturovaný údaj)." : "";
  return `${CSU_CAVEAT}${units}${band}${estimate}${area}${lowConf}`;
}

function CsuCompareHero({ csu, listingPc }: { csu?: Listing["csu_compare"]; listingPc?: Listing["price_compare"] }) {
  if (!csu) return <PriceCompareHero />;
  const weak = csu.area_warning || csu.area_low_confidence;
  return (
    <div className={`flex flex-col gap-2 ${weak ? "text-muted-foreground" : ""}`} title={csuTooltip(csu)}>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col leading-none">
          <span className={`inline-flex items-center gap-1.5 text-xl font-bold ${weak ? "text-muted-foreground" : PC_TEXT[csu.band]}`}>
            {weak && <AlertTriangle className="h-4 w-4 shrink-0" aria-label="Orientační srovnání" />}
            {csu.verdict_label}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">vs. realizované ceny ČSÚ · {csu.size_band_label}</span>
        </div>
        <span className={`text-[11px] font-semibold ${weak ? "text-muted-foreground" : PC_TEXT[csu.band]}`}>{csu.scope_label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-2">
        <Metric label="Tato nabídka" value={`${csu.own_per_m2.toLocaleString("cs-CZ")} Kč/m² užitné`} />
        <Metric label="ČSÚ 2025" value={`${csu.benchmark_per_m2.toLocaleString("cs-CZ")} Kč/m² obytné`} />
      </div>
      {listingPc && listingPc.samples >= 10 && (
        <div className="text-[10px] text-muted-foreground">
          Nabídkový medián: {listingPc.median_per_m2.toLocaleString("cs-CZ")} Kč/m² ({pcScope(listingPc.scope)}, n={listingPc.samples})
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">Realizované ceny · {csu.scope_label} · odhad, ne přesné procento</div>
    </div>
  );
}


function PriceCompareBadge({ pc }: { pc?: Listing["price_compare"] }) {
  if (!pc) {
    return (
      <div className="text-[10px] text-muted-foreground">Cena/m²: nedostatek dat pro srovnání</div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${PC_TEXT[pc.band]} ${
        pc.band === "below" ? "border-emerald-500/40 bg-emerald-500/10"
          : pc.band === "above" ? "border-red-500/40 bg-red-500/10"
          : "border-border bg-muted/40"
      }`}>
        {pcVs(pc)}
      </span>
      <span>{PC_LABEL[pc.band]} · medián z {pc.samples} srovnatelných ({pcScope(pc.scope)})</span>
    </div>
  );
}


export function ListingCard({ listing, density = "card", rank }: { listing: Listing; density?: Density; rank?: number }) {
  if (density === "list") return <ListingRow listing={listing} />;
  if (density === "compact") return <ListingCompact listing={listing} />;
  return <ListingFull listing={listing} rank={rank} />;
}

function ListingFull({ listing, rank }: { listing: Listing; rank?: number }) {
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
  const tier = tierOf(inv?.stars);
  const trap = hasPriceTrap(listing.flags);
  const isHouse = listing.property_type === "domy";


  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
    >
      {rank && rank <= 3 && (
        <span className="absolute right-0 top-0 z-10 rounded-bl-lg bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
          #{rank} nejvyšší výnos
        </span>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Source + badges řada */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: sourceDotColor(listing.source) }}
            />
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

        {/* Lokalita + čas */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          {listing.locality ? (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{listing.locality}</span>
            </span>
          ) : <span />}
          {dateText && (
            <span
              title={isFallbackDate ? "Datum nebylo k dispozici — zobrazen čas skenu" : "Datum zveřejnění"}
              className={`shrink-0 ${isFallbackDate ? "italic opacity-60" : ""}`}
            >
              {isFallbackDate ? `~ ${dateText}` : dateText}
            </span>
          )}
        </div>

        <FlagChips flags={listing.flags} />

        {/* Cena + plocha + OV/DV chip */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col">
            <span className="font-mono text-lg font-bold text-primary leading-tight">{listing.price_text}</span>
            {pricePerM2 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {pricePerM2.toLocaleString("cs-CZ")} Kč/m²
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {listing.area && (
              <span className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1 font-mono text-[11px] font-semibold text-foreground">
                {listing.area}
              </span>
            )}
            {listing.land_area_m2 ? (
              <span
                title="Plocha pozemku"
                className="rounded-md border border-border bg-[var(--color-surface-2)] px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground"
              >
                🌳 {listing.land_area_m2.toLocaleString("cs-CZ")} m²
              </span>
            ) : null}
            <span
              title={own.full}
              className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide ${own.cls}`}
            >
              {own.short}
            </span>
          </div>
        </div>

        {anuity?.has_anuity && (
          <div
            className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[10px] leading-snug text-red-200"
            title={anuity.source_phrase || undefined}
          >
            <div className="font-semibold uppercase tracking-wider text-red-300">
              ⚠ Anuita / nesplacený úvěr
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

      {/* DOMY — hlavní metrika je cena/m² vs. průměr (nájemní výnos se nezobrazuje) */}
      {isHouse && (
        <div className={`flex flex-col gap-3 p-3 ${PC_BLOCK[listing.csu_compare?.band ?? "none"]}`}>
          <CsuCompareHero csu={listing.csu_compare} listingPc={listing.price_compare} />
          <div className="flex items-center justify-end gap-1.5">
            <SaveBookmarkButton listing={listing} />
            <AIAnalysisButton listing={listing} />
          </div>
        </div>
      )}

      {/* VERDICT BLOCK — hero (velký výnos + hvězdy) + 3 metriky */}
      {!isHouse && inv && (
        <div className={`flex flex-col gap-3 p-3 ${TIER_VERDICT[tier]}`}>
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col leading-none">
              {trap ? (
                <span title="Skrytý náklad — výnos neověřen" className="font-mono text-3xl font-bold text-amber-300">
                  ověřit
                </span>
              ) : (
                <span className={`font-mono text-3xl font-bold ${TIER_YIELD[tier]}`}>
                  {inv.net_yield.toString().replace(".", ",")}
                  <span className="ml-0.5 text-base font-semibold opacity-80">%</span>
                </span>
              )}
              <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                čistý výnos p.a.
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Stars n={inv.stars} cls={TIER_STARS[tier]} />
              <span className={`text-[11px] font-semibold ${TIER_YIELD[tier]}`}>{inv.verdict}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-2">
            <Metric label="Hrubý výnos" value={trap ? "—" : `${inv.gross_yield.toString().replace(".", ",")} %`} />
            <Metric label="Nájem/měs." value={`${inv.monthly_rent.toLocaleString("cs-CZ")} Kč`} />
            <Metric label="Návratnost" value={`${inv.payback_years} let`} />
          </div>

          <PriceCompareBadge pc={listing.price_compare} />

          {inv.rent_basis_label && (
            <div
              className="text-[10px] text-muted-foreground"
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
            <div className="text-[10px] font-semibold text-red-300">
              ⚠ Výnos přepočten z efektivní ceny vč. anuity
            </div>
          )}

          <div className="flex items-center justify-end gap-1.5">
            <SaveBookmarkButton listing={listing} />
            <AIAnalysisButton listing={listing} />
          </div>
        </div>
      )}

    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
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
      {listing.property_type === "domy" ? (
        <div
          className={`flex items-center justify-between rounded-sm px-1.5 py-1 text-[10px] ${PC_BLOCK[listing.csu_compare?.band ?? "none"]}`}
          title={listing.csu_compare ? csuTooltip(listing.csu_compare) : undefined}
        >
          {listing.csu_compare ? (
            <>
              <span className={`inline-flex items-center gap-1 font-semibold ${listing.csu_compare.area_warning || listing.csu_compare.area_low_confidence ? "text-muted-foreground" : PC_TEXT[listing.csu_compare.band]}`}>
                {(listing.csu_compare.area_warning || listing.csu_compare.area_low_confidence) && <AlertTriangle className="h-3 w-3 shrink-0" aria-label="Orientační srovnání" />}
                {listing.csu_compare.verdict_label} vs. ČSÚ
              </span>

              <span className="text-muted-foreground">{listing.csu_compare.scope_label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">nedostatek dat pro srovnání</span>
          )}
        </div>
      ) : inv ? (() => {
        const t = tierOf(inv.stars);
        return (
          <div className={`flex items-center justify-between rounded-sm px-1.5 py-1 text-[10px] ${TIER_VERDICT[t]}`}>
            <span className={`font-mono font-semibold ${TIER_YIELD[t]}`}>{inv.net_yield}% čistý</span>
            <span className={`font-mono tracking-wider ${TIER_STARS[t]}`}>
              {"★".repeat(inv.stars)}
            </span>
          </div>
        );
      })() : null}

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
        {listing.property_type === "domy" ? (
          listing.csu_compare && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold ${listing.csu_compare.area_warning || listing.csu_compare.area_low_confidence ? "text-muted-foreground" : PC_TEXT[listing.csu_compare.band]}`}
              title={csuTooltip(listing.csu_compare)}
            >
              {(listing.csu_compare.area_warning || listing.csu_compare.area_low_confidence) && <AlertTriangle className="h-3 w-3 shrink-0" aria-label="Orientační srovnání" />}
              {listing.csu_compare.verdict_label} vs. ČSÚ

            </span>
          )
        ) : inv ? (
          <span className={`font-mono text-[10px] font-semibold ${TIER_YIELD[tierOf(inv.stars)]}`}>
            {inv.net_yield}% · {"★".repeat(inv.stars)}
          </span>
        ) : null}

      </div>
    </a>
  );
}
