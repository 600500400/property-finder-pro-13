import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-[var(--color-surface)] px-5 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div>© {new Date().getFullYear()} RealityScanner</div>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/cenik" className="hover:text-foreground">Ceník</Link>
          <Link to="/obchodni-podminky" className="hover:text-foreground">Obchodní podmínky</Link>
          <Link to="/ochrana-osobnich-udaju" className="hover:text-foreground">Ochrana osobních údajů</Link>
        </nav>
      </div>
    </footer>
  );
}
