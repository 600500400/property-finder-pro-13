import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";
import { AlertOctagon, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/5-chyb-investora-do-nemovitosti")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/5-chyb-investora-do-nemovitosti",
      "5 nejčastějších chyb začínajícího investora do nemovitostí | RealityScanner",
      "Na čem v ČR investoři nejčastěji prodělají? Ignorování fondu oprav, nerealistický odhad nájmu, špatná dispozice a další drahé pasti.",
    ),
  component: () => (
    <PublicGuide
      title="5 nejčastějších chyb začínajícího investora do nemovitostí"
      intro="Investice do bytu je pro většinu lidí největší finanční transakcí v životě. Chyby při výběru nemovitosti se nepočítají ve stovkách korun, ale ve stovkách tisíc. Zde je 5 pastí, do kterých nováčci nejčastěji spadnou."
    >
      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
          Počítání výnosu z nerealistického nebo nabídkového nájmu
        </h2>
        <p className="text-muted-foreground">
          Častý omyl: Investor vidí v sousedním inzerátu nájem 20 000 Kč a automaticky s touto částkou
          počítá ve svém modelu. Jenže nabídková cena na portálu není částka, za kterou se byt skutečně
          pronajme. Vždy pracujte s konzervativním odhadem a ověřte si skutečné realizované pronájmy
          v dané ulici.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>
          Přehlédnutí vysokého fondu oprav a anuity
        </h2>
        <p className="text-muted-foreground">
          Levný panelový byt může skrývat měsíční fond oprav ve výši 4 500 Kč, protože SVJ splácí
          drahou rekonstrukci výtahu nebo zateplení. U družstevních bytů zase často inzerát uvádí
          nízkou cenu, ale zatajuje nesplacenou anuitu v řádu stovek tisíc. Vždy si před koupí
          vyžádejte evidenční list a hospodaření SVJ/družstva.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
          Nákup špatné dispozice pro danou lokalitu
        </h2>
        <p className="text-muted-foreground">
          Velký byt 4+1 (90 m²) v širším centru může lákat velkou plochou, ale nájem na metr
          čtvereční je u velkých bytů výrazně nižší. Rodina, která by takový byt zaplatila, často
          dává přednost vlastnímu bydlení. Naopak kompaktní 1+kk a 2+kk (35–55 m²) mají nejvyšší nájem
          na m² a nejširší skupinu poptávajících.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">4</span>
          Nulová finanční rezerva na neobsazenost
        </h2>
        <p className="text-muted-foreground">
          Počítat se 100% obsazeností 12 měsíců v roce po dobu 10 let je iluze. Nájemce odejde, byt
          je potřeba vymalovat, vyměnit pračku a hledat nového nájemce. Počítejte minimálně s 1 měsícem
          neobsazenosti jednou za dva roky (cca 4–5 % ročního příjmu jako rezerva).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">5</span>
          Zamilování se do nemovitosti místo koukání na čísla
        </h2>
        <p className="text-muted-foreground">
          V investiční nemovitosti nebudete bydlet vy. Nepotřebujete designovou italskou dlažbu ani
          krásný výhled do parku, pokud zvyšují pořizovací cenu o milion, ale nájem zvednou jen o 500 Kč.
          Investice je čistě matematická disciplína: poměr mezi nákupní cenou a udržitelným cashflow.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <h3 className="font-semibold text-primary">Jak vám RealityScanner pomůže tyto chyby eliminovat?</h3>
        <p className="text-xs text-muted-foreground">
          Náš algoritmus automaticky detekuje dispozici, dispozici korigovaný tržní nájem okresu,
          upozorní na anuitu v inzerátu a spočítá reálnou návratnost v letech u každé nabídky ze 4 portálů.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Filtrovat bezpečné nabídky v RealityScanneru →
          </Link>
        </div>
      </section>
    </PublicGuide>
  ),
});
