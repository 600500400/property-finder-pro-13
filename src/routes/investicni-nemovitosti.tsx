import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";

export const Route = createFileRoute("/investicni-nemovitosti")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/investicni-nemovitosti",
      "Investiční nemovitosti: jak vybrat byt či dům",
      "Praktický postup výběru investiční nemovitosti. Porovnejte cenu, nájem, náklady a rizika, než si domluvíte prohlídku.",
    ),
  component: () => (
    <PublicGuide
      title="Jak vybírat investiční nemovitosti"
      intro="Levná nemovitost nemusí být dobrá investice. Začněte tím, komu ji chcete pronajímat, kolik skutečně zaplatíte a jaké riziko unesete. RealityScanner pomáhá zúžit výběr nabídek k osobnímu ověření."
    >
      <section>
        <h2 className="text-xl font-semibold">1. Určete lokalitu a poptávku po nájmu</h2>
        <p className="mt-3 text-muted-foreground">
          Doprava, zaměstnavatelé a školy mohou ovlivnit obsazenost víc než nízká kupní cena.
          Srovnávejte stejnou mikro-lokalitu, dispozici a stav. Nabídkový nájem není důkaz skutečně
          uzavřené nájemní smlouvy.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">2. Počítejte s celou investicí</h2>
        <p className="mt-3 text-muted-foreground">
          K ceně přidejte rekonstrukci, vybavení, právní služby a případnou anuitu. U podílu
          nekupujete automaticky celý byt. Vyvolávací cena v dražbě není konečná pořizovací cena.
          Pokud chybí spolehlivá částka, výnos nejprve nelze určit.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">3. Ověřte výnos i horší scénář</h2>
        <p className="mt-3 text-muted-foreground">
          Od nájmu odečtěte náklady majitele a neobsazenost. Zkuste nižší nájem nebo dražší opravu.
          Splátku hypotéky řešte navíc v peněžním toku; výnos nemovitosti a peníze zbývající po
          splátce nejsou totéž.
        </p>
        <Link to="/kalkulacka-vynosu" className="mt-3 inline-block text-primary hover:underline">
          Spočítat vlastní scénář →
        </Link>
      </section>
      <section>
        <h2 className="text-xl font-semibold">4. Před nabídkou prověřte dokumenty</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>List vlastnictví, břemena a právní přístup.</li>
          <li>Stav domu, zápisy SVJ, plán oprav a závazky.</li>
          <li>Nájemní smlouvu, pokud je byt obsazený.</li>
          <li>Technickou prohlídku a rozpočet oprav.</li>
        </ul>
        <Link
          to="/jak-poznat-predrazeny-byt"
          className="mt-3 inline-block text-primary hover:underline"
        >
          Jak porovnat nabídkovou cenu →
        </Link>
      </section>
    </PublicGuide>
  ),
});
