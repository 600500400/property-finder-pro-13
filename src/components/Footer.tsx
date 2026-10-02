import { Link } from "@tanstack/react-router";
import { OPERATOR } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-[var(--color-surface)] px-5 py-6 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© 2026 RealityScanner · Ing. Kamil Němec · IČO 88549836</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/cenik" className="hover:text-foreground">Ceník</Link>
            <Link to="/metodika" className="hover:text-foreground">Metodika</Link>
            <Link to="/kontakt" className="hover:text-foreground">Kontakt</Link>
            <Link to="/obchodni-podminky" className="hover:text-foreground">Obchodní podmínky</Link>
            <Link to="/ochrana-osobnich-udaju" className="hover:text-foreground">Ochrana osobních údajů</Link>
          </nav>
        </div>
        <div className="border-t border-border/50 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="font-semibold text-foreground">Průvodce investováním & Blog:</span>
          <Link to="/kde-koupit-investicni-byt-2026" className="text-primary hover:underline">Kde koupit byt 2026</Link>
          <Link to="/kolik-vydelava-byt-2kk-brno" className="text-primary hover:underline">Výnos 2+kk v Brně</Link>
          <Link to="/5-chyb-investora-do-nemovitosti" className="text-primary hover:underline">5 chyb investora</Link>
          <Link to="/sreality-vs-bezrealitky-srovnani" className="text-primary hover:underline">Sreality vs Bezrealitky</Link>
          <Link to="/investicni-nemovitosti" className="hover:text-foreground">Jak vybrat nemovitost</Link>
          <Link to="/kalkulacka-vynosu" className="hover:text-foreground">Kalkulačka výnosu</Link>
          <Link to="/jak-poznat-predrazeny-byt" className="hover:text-foreground">Jak porovnat cenu</Link>
        </div>
      </div>
    </footer>
  );
}
