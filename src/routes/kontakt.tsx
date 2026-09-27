import { createFileRoute } from "@tanstack/react-router";
import { PublicGuide } from "@/components/PublicGuide";
import { OperatorDetails } from "@/components/OperatorDetails";
import { publicPageHead } from "@/lib/site";

export const Route = createFileRoute("/kontakt")({
  staticData: { sitemap: true },
  head: () =>
    publicPageHead(
      "/kontakt",
      "Kontakt a provozovatel",
      "Kontakt na provozovatele RealityScanneru, podporu, platby a ochranu osobních údajů. Ing. Kamil Němec, IČO 88549836.",
    ),
  component: () => (
    <PublicGuide
      title="Kontakt a provozovatel"
      intro="Potřebujete poradit s účtem, předplatným nebo nahlásit chybný údaj? Napište nám."
    >
      <OperatorDetails />
      <section>
        <h2 className="text-xl font-semibold">Podpora a reklamace</h2>
        <p className="mt-3 text-muted-foreground">
          Uveďte e-mail svého účtu a popis problému. U inzerátu připojte odkaz a datum zobrazení.
          Neposílejte heslo ani celé číslo platební karty. Stejný kontakt slouží i pro žádosti
          týkající se osobních údajů.
        </p>
      </section>
    </PublicGuide>
  ),
});
