import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";

export const Route = createFileRoute("/jak-poznat-predrazeny-byt")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/jak-poznat-predrazeny-byt",
      "Jak poznat předražený byt",
      "Cena za m² sama nestačí. Jak vybírat srovnatelné byty, číst medián a zohlednit stav, vlastnictví a náklady na rekonstrukci.",
    ),
  component: () => (
    <PublicGuide
      title="Jak poznat předražený byt"
      intro="Vyšší cena než průměr nemusí znamenat špatnou nabídku. Rozhodující je, zda rozdíl vysvětluje lokalita, stav nebo jiná skutečná výhoda."
    >
      <section>
        <h2 className="text-xl font-semibold">Vyberte skutečně srovnatelné nabídky</h2>
        <p className="mt-3 text-muted-foreground">
          Srovnávejte podobnou výměru, dispozici, vlastnictví, technický stav a okolí. Novostavba a
          byt před rekonstrukcí nejsou jedna referenční skupina. Družstevní byt s neznámou anuitou
          nemá známou celkovou kupní cenu.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Čtěte medián spolu s počtem vzorků</h2>
        <p className="mt-3 text-muted-foreground">
          Medián je prostřední hodnota seřazeného souboru, ne průměr několika nejlevnějších nabídek.
          Pokud jsou k dispozici jen dva či tři byty, berte výsledek jako slabý signál. Duplicitní
          inzeráty stejného bytu by výsledek neměly posouvat.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Připočtěte rozdíly, které cena za m² nevidí</h2>
        <p className="mt-3 text-muted-foreground">
          Výtah, patro, hlučnost, balkon, úspornost domu i plánované opravy mohou změnit celkové
          náklady. Ověřte, zda výměra zahrnuje sklep či terasu. U domu nepřenášejte bez ověření cenu
          obytné plochy na užitnou plochu a rekreační objekt neporovnávejte automaticky s rodinným
          domem.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Připravte otázky pro makléře</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Co je zahrnuto v ceně a jaká je ověřená výměra?</li>
          <li>Kolik stojí opravy a jaké závazky váznou na bytě či domě?</li>
          <li>Jak dlouho se nemovitost nabízí a jak se měnila cena?</li>
          <li>Je doložitelný nájem, nebo jde pouze o odhad?</li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Nabídková cena není realizovaná kupní cena. Cenové srovnání je podklad pro další prověrku,
          nikoliv znalecké ocenění.
        </p>
        <Link to="/kalkulacka-vynosu" className="mt-3 inline-block text-primary hover:underline">
          Porovnat cenu s očekávaným výnosem →
        </Link>
      </section>
    </PublicGuide>
  ),
});
