import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";

export function PublicGuide({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="text-primary hover:underline">
            ← RealityScanner
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">{intro}</p>
        </div>
        {children}
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-xl font-semibold">Prověřte konkrétní nabídky</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Začněte bez platební karty. Výpočty jsou orientační a nenahrazují právní ani technickou
            prověrku.
          </p>
          <nav className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/" className="text-primary hover:underline">
              Otevřít skener zdarma
            </Link>
            <Link to="/metodika" className="text-primary hover:underline">
              Metodika a omezení
            </Link>
            <Link to="/cenik" className="text-primary hover:underline">
              Co obsahuje Premium
            </Link>
          </nav>
        </section>
      </main>
      <Footer />
    </div>
  );
}
