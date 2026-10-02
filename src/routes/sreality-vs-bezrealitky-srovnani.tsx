import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { publicPageHead } from "@/lib/site";
import { ArrowRight, Layers, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/sreality-vs-bezrealitky-srovnani")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/sreality-vs-bezrealitky-srovnani",
      "Sreality vs Bezrealitky: Kde najdete lepší nabídky pro investici? | RealityScanner",
      "Srovnání největších českých portálů z pohledu investora. Provize, rychlost prodeje, vyjednávací prostor a proč se vyplatí sledovat oba najednou.",
    ),
  component: () => (
    <PublicGuide
      title="Sreality vs Bezrealitky: Kde se víc vyplatí hledat investiční byt?"
      intro="Každý český investor řeší stejné dilema: Procházet největší nabídku na Sreality s makléřskou provizí, nebo zkoušet štěstí na Bezrealitky přímo od majitelů? Zde je srovnání výhod, nevýhod a reálné praxe."
    >
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Srovnání klíčových parametrů</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-2)] font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Kritérium</th>
                <th className="px-3 py-2.5">Sreality.cz</th>
                <th className="px-3 py-2.5">Bezrealitky.cz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2.5 font-semibold">Podíl na trhu</td>
                <td className="px-3 py-2.5 font-mono text-primary">Cca 75–85 % nabídek</td>
                <td className="px-3 py-2.5 font-mono">Cca 10–15 % nabídek</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Provize zprostředkovatele</td>
                <td className="px-3 py-2.5 text-amber-400">3 až 5 % + DPH (často v ceně)</td>
                <td className="px-3 py-2.5 text-emerald-400">0 % (přímý prodej)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Očekávání ceny prodávajícího</td>
                <td className="px-3 py-2.5">Korigováno makléřem</td>
                <td className="px-3 py-2.5 text-amber-400">Často přemrštěné soukromníky</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Rychlost prodeje výhodných bytů</td>
                <td className="px-3 py-2.5 text-amber-400">Extrémní (hodiny až dny)</td>
                <td className="px-3 py-2.5">Střední (jednání s majitelem)</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-semibold">Prostor pro vyjednávání</td>
                <td className="px-3 py-2.5">Vyšší u ležáků (makléř chce provizi)</td>
                <td className="px-3 py-2.5">Emoční vazba majitele komplikuje slevu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Mýtus: „Na Bezrealitky koupím vždy levněji“</h2>
        <p className="text-muted-foreground">
          Mnoho začínajících investorů si myslí, že absence realitního makléře automaticky znamená
          nižší cenu. V praxi to ale často bývá naopak: Soukromý majitel si řekne: <em>„Makléř by si
          vzal 200 000 Kč provize, tak o těch 200 000 Kč cenu navýším a nechám si to sám.“</em>
        </p>
        <p className="text-muted-foreground">
          Navíc soukromí prodávající mají k nemovitosti silné emoční pouto (vzpomínky na dětství či rekonstrukci)
          a často odmítají slevit i po měsících neúspěšné inzerce.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Proč nezapomínat na Bazoš a iDnes Reality?</h2>
        <p className="text-muted-foreground">
          Kromě dvou gigantů existují portály jako <strong>Bazoš</strong> a <strong>iDnes Reality</strong>.
          Právě na Bazoši se často objevují soukromé inzeráty starších majitelů, kteří nechtějí platit
          poplatky za inzerci a nemovitost nabídnou za velmi atraktivní cenu. Tyto klenoty však
          většina lidí přehlédne.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Layers className="h-5 w-5" /> Proč přepínat mezi 4 záložkami, když můžete mít vše v jednom?
        </div>
        <p className="text-xs text-muted-foreground">
          RealityScanner agreguje <strong>Sreality, Bezrealitky, Bazoš i iDnes Reality</strong> do jednoho
          přehledného feedu. Odstraní duplicity a u každé nabídky okamžitě spočítá výnos z nájmu
          a srovnání s cenou v okrese.
        </p>
        <div className="pt-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Sledovat všechny 4 portály najednou zdarma →
          </Link>
        </div>
      </section>
    </PublicGuide>
  ),
});
