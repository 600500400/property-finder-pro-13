import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";
import { CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/kde-koupit-investicni-byt-2026")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/kde-koupit-investicni-byt-2026",
      "Kde v ČR se nejvíc vyplatí koupit investiční byt v roce 2026 | RealityScanner",
      "Velké srovnání výnosnosti bytů napříč kraji a okresy ČR pro rok 2026. Kde dosáhnete výnosu přes 6 % a kde se investice stává pastí.",
    ),
  component: () => (
    <PublicGuide
      title="Kde v ČR se nejvíc vyplatí koupit investiční byt v roce 2026?"
      intro="Český realitní trh se v roce 2026 výrazně rozvrstvil. Zatímco v Praze a Brně tlačí vysoké kupní ceny roční výnos pod 4 %, v regionech lze dosáhnout 6 až 8 %. Zde je přehledné srovnání výnosů, rizik a doporučených strategií."
    >
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Rychlé srovnání výnosnosti podle regionů</h2>
        <p className="text-muted-foreground">
          Při investování do nemovitostí v ČR vždy volíte kompromis mezi ročním výnosem z nájmu a
          dlouhodobým růstem kapitálové hodnoty nemovitosti:
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-2)] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Region</th>
                <th className="px-3 py-2.5">Typický výnos</th>
                <th className="px-3 py-2.5">Kapitálový růst</th>
                <th className="px-3 py-2.5">Riziko neobsazenosti</th>
                <th className="px-3 py-2.5">Strategie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2.5 font-semibold">Praha</td>
                <td className="px-3 py-2.5 font-mono text-amber-400">3,2 – 4,0 %</td>
                <td className="px-3 py-2.5 text-emerald-400">Vysoký ★★★</td>
                <td className="px-3 py-2.5">Minimální</td>
                <td className="px-3 py-2.5 text-muted-foreground">Ochrana kapitálu</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Brno & Jihomoravský</td>
                <td className="px-3 py-2.5 font-mono text-amber-400">3,8 – 4,6 %</td>
                <td className="px-3 py-2.5 text-emerald-400">Vysoký ★★★</td>
                <td className="px-3 py-2.5">Nízké</td>
                <td className="px-3 py-2.5 text-muted-foreground">Studenti & IT specialisté</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Krajská města (Plzeň, Olomouc, HK)</td>
                <td className="px-3 py-2.5 font-mono text-emerald-400">4,5 – 5,5 %</td>
                <td className="px-3 py-2.5">Střední ★★☆</td>
                <td className="px-3 py-2.5">Nízké</td>
                <td className="px-3 py-2.5 text-muted-foreground">Ideální poměr výnos/riziko</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Moravskoslezský kraj (Ostrava)</td>
                <td className="px-3 py-2.5 font-mono text-emerald-400">5,5 – 7,0 %</td>
                <td className="px-3 py-2.5">Mírný ★☆☆</td>
                <td className="px-3 py-2.5">Střední</td>
                <td className="px-3 py-2.5 text-muted-foreground">Vysoký peněžní tok</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Ústecký kraj (Most, Teplice, Chomutov)</td>
                <td className="px-3 py-2.5 font-mono text-emerald-300">6,5 – 8,5 %</td>
                <td className="px-3 py-2.5">Nízký ☆☆☆</td>
                <td className="px-3 py-2.5 text-amber-400">Vysoké</td>
                <td className="px-3 py-2.5 text-muted-foreground">Nutná aktivní správa</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Praha a Brno: Bezpečné přístavy s nižším výnosem</h2>
        <p className="text-muted-foreground">
          V Praze i Brně se cena za metr čtvereční pohybuje vysoko nad 100 000 Kč. Z nájmu zde
          běžně dostanete výnos kolem 3,5 až 4,2 %. Důvodem, proč investoři přesto v těchto metropolích
          nakupují, je prakticky nulová neobsazenost (byt pronajmete během týdne) a stabilní
          zhodnocení samotné nemovitosti v čase.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. „Zlatý střed“ roku 2026: Univerzitní a krajská města</h2>
        <p className="text-muted-foreground">
          Pro většinu individuálních investorů představují nejvyváženější volbu krajská města jako{" "}
          <strong>Plzeň, Olomouc, Hradec Králové, Pardubice nebo České Budějovice</strong>.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li><strong>Výnos 4,5 až 5,5 %:</strong> Kupní ceny jsou výrazně nižší než v Praze, ale nájmy jsou stále solidní.</li>
          <li><strong>Stabilní poptávka:</strong> Přítomnost univerzit, nemocnic a velkých zaměstnavatelů zaručuje stálý přísun spolehlivých nájemníků.</li>
          <li><strong>Menší konkurence velkých fondů:</strong> Byt v dobrém stavu se zde hledá snáze než na přehřátém pražském trhu.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Severní Čechy a Ostrava: Papírový ráj s reálnými háčky</h2>
        <p className="text-muted-foreground">
          V inzerátech v Mostě, Chomutově nebo Karviné narazíte na byty za 1,2 mil. Kč s ročním
          výnosem přes 8 %. Než takový byt koupíte, je nutné počítat s riziky:
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-2 text-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Pozor na skryté náklady u levných bytů
          </div>
          <p>
            Vysoké fondy oprav u panelových domů s neplatiči, častější střídání nájemníků, riziko
            poškození bytu a nutnost přísného screeningu nájemců. Z papírových 8 % se po započtení
            výpadků může snadno stát 4 %.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Jak najít podhodnocený byt v jakémkoli kraji?</h2>
        <p className="text-muted-foreground">
          V každém městě se čas od času objeví nabídka, kterou majitel z rodinných či finančních
          důvodů nabízí pod tržní cenou. Tyto inzeráty však mizí během několika hodin.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <TrendingUp className="h-4 w-4" /> Prozkoumat nejvýnosnější byty na trhu právě teď
          </Link>
        </div>
      </section>
    </PublicGuide>
  ),
});
