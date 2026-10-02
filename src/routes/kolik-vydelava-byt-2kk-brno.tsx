import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";
import { Calculator, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/kolik-vydelava-byt-2kk-brno")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/kolik-vydelava-byt-2kk-brno",
      "Kolik vydělává byt 2+kk v Brně — reálná čísla a kalkulace 2026 | RealityScanner",
      "Konkrétní případová studie bytu 2+kk v Brně. Pořizovací cena, tržní nájem, reálné náklady a přesný výpočet ročního výnosu a návratnosti.",
    ),
  component: () => (
    <PublicGuide
      title="Kolik vydělává investiční byt 2+kk v Brně v roce 2026?"
      intro="Dispozice 2+kk je v Brně dlouhodobě nejžádanějším investičním formátem. Hledají ji mladé páry, zaměstnanci technologických firem i studenti sdílející bydlení. Kolik takový byt skutečně vynáší v čistých číslech?"
    >
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Modelový příklad: Byt 2+kk v Brně (50 m²)</h2>
        <p className="text-muted-foreground">
          Pojďme se podívat na realistický příklad standardního bytu v dobrém stavu (např. Královo Pole,
          Židenice nebo Bystrc):
        </p>

        <div className="rounded-xl border border-border bg-[var(--color-surface)] p-5 space-y-4">
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-[var(--color-surface-2)] p-3">
              <span className="text-muted-foreground">Pořizovací cena:</span>
              <div className="mt-1 font-mono text-lg font-bold">4 600 000 Kč</div>
              <span className="text-[10px] text-muted-foreground">(92 000 Kč / m²)</span>
            </div>
            <div className="rounded-lg border border-border/60 bg-[var(--color-surface-2)] p-3">
              <span className="text-muted-foreground">Tržní nájem (bez energií):</span>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-400">17 500 Kč / měs</div>
              <span className="text-[10px] text-muted-foreground">(350 Kč / m² měsíčně)</span>
            </div>
            <div className="rounded-lg border border-border/60 bg-[var(--color-surface-2)] p-3">
              <span className="text-muted-foreground">Roční hrubý výnos:</span>
              <div className="mt-1 font-mono text-lg font-bold text-primary">4,56 % p.a.</div>
              <span className="text-[10px] text-muted-foreground">(210 000 Kč ročně)</span>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 text-xs space-y-2">
            <div className="font-semibold text-foreground">Výpočet výnosu:</div>
            <div className="font-mono text-muted-foreground">
              (17 500 Kč × 12 měsíců) ÷ 4 600 000 Kč × 100 = <strong>4,56 %</strong>
            </div>
            <div className="text-muted-foreground">
              Návratnost investice (prostá): <strong>21,9 let</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Jaké náklady jdou na vrub majitele?</h2>
        <p className="text-muted-foreground">
          Energie a služby spojené s užíváním (voda, teplo, úklid domu) hradí nájemce. Majitel však
          musí počítat s výdaji, které nelze přenést:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li><strong>Příspěvek do fondu oprav / správa SVJ:</strong> Typicky 1 500 až 2 500 Kč měsíčně podle stáří a zateplení domu.</li>
          <li><strong>Pojištění nemovitosti a domácnosti:</strong> Cca 150 až 300 Kč měsíčně.</li>
          <li><strong>Daň z nemovitých věcí:</strong> Po nedávném navýšení cca 100 až 200 Kč měsíčně.</li>
          <li><strong>Rezerva na údržbu a neobsazenost:</strong> Doporučujeme počítat s rezervou 1 měsíčního nájmu jednou za 2 roky na vymalování či opravu spotřebičů.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Co dělá lokalita v Brně s výnosem?</h2>
        <p className="text-muted-foreground">
          Rozpětí nájmů v Brně je znatelné:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li><strong>Centrum, Veveří, Černá Pole:</strong> Vyšší nájem (až 20 000 Kč), ale výrazně vyšší nákupní cena za m². Výnos bývá kolem 3,9–4,2 %.</li>
          <li><strong>Královo Pole, Žabovřesky, Medlánky:</strong> Špičková poptávka od technologických firem (IBM, Red Hat atd.), výnos kolem 4,3–4,7 %.</li>
          <li><strong>Bystrc, Líšeň, Starý Lískovec:</strong> Cenově dostupnější byty, výnos často překročí 4,8 %.</li>
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Calculator className="h-5 w-5" /> Chcete si spočítat vlastní scénář s hypotékou nebo přesnými náklady?
        </div>
        <p className="text-xs text-muted-foreground">
          Použijte naši interaktivní kalkulačku, kde si můžete zadat vlastní nákupní cenu, očekávaný
          nájem a měsíční fond oprav.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            to="/kalkulacka-vynosu"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Otevřít kalkulačku výnosu →
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-accent"
          >
            Hledat byty 2+kk v Brně ve skeneru →
          </Link>
        </div>
      </section>
    </PublicGuide>
  ),
});
