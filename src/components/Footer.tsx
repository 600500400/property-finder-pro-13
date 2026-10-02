import { Link } from "@tanstack/react-router";
import { OPERATOR } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-[var(--color-surface)] px-5 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div>© 2026 RealityScanner · Ing. Kamil Němec · IČO 88549836<br />
        </div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/cenik" className="hover:text-foreground">Ceník</Link>
          <Link to="/metodika" className="hover:text-foreground">Metodika</Link>
          <details>
            <summary className="cursor-pointer hover:text-foreground">Průvodce investováním</summary>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link to="/investicni-nemovitosti" className="hover:text-foreground">Investiční nemovitosti</Link>
              <Link to="/kalkulacka-vynosu" className="hover:text-foreground">Kalkulačka výnosu</Link>
              <Link to="/jak-poznat-predrazeny-byt" className="hover:text-foreground">Jak porovnat cenu</Link>
              <Link to="/kde-koupit-investicni-byt-2026" className="hover:text-foreground">Kde koupit byt 2026</Link>
              <Link to="/kolik-vydelava-byt-2kk-brno" className="hover:text-foreground">Výnos 2+kk v Brně</Link>
              <Link to="/5-chyb-investora-do-nemovitosti" className="hover:text-foreground">5 chyb investora</Link>
              <Link to="/sreality-vs-bezrealitky-srovnani" className="hover:text-foreground">Sreality vs Bezrealitky</Link>
            </div>
          </details>
          <Link to="/kontakt" className="hover:text-foreground">Kontakt</Link>
          <Link to="/obchodni-podminky" className="hover:text-foreground">Obchodní podmínky</Link>
          <Link to="/ochrana-osobnich-udaju" className="hover:text-foreground">Ochrana osobních údajů</Link>
        </nav>
      </div>
    </footer>
  );
}
