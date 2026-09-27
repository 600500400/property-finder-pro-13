import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { OperatorDetails } from "@/components/OperatorDetails";
import { OPERATOR } from "@/lib/site";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/obchodni-podminky")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Obchodní podmínky — RealityScanner" },
      { name: "description", content: "Obchodní podmínky služby RealityScanner: rozsah služby, platby, odstoupení od smlouvy." },
      // Legal pages are public but not acquisition landing pages.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Obchodní podmínky — RealityScanner" },
      { property: "og:description", content: "Podmínky užívání služby RealityScanner, platby a odstoupení od smlouvy." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Obchodní podmínky — RealityScanner" },
      { name: "twitter:description", content: "Podmínky užívání služby RealityScanner, platby a odstoupení od smlouvy." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zpět
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Obchodní podmínky</h1>

        <Section title="1. Provozovatel">
          <OperatorDetails />
          <p className="mt-2 text-sm">
            (dále jen „Provozovatel“) provozuje webovou službu RealityScanner dostupnou
            na adrese této aplikace (dále jen „Služba“).
          </p>
        </Section>

        <Section title="2. Předmět služby">
          <p>
            Služba umožňuje uživatelům vyhledávat veřejně dostupné inzeráty z českých realitních
            portálů, agregovat je a provádět jejich analýzu (např. výnosnost, cena za m²).
            Služba je nabízena v bezplatné variantě („Free“) a v placené variantě („Premium“)
            s rozšířenou funkcionalitou popsanou na stránce <Link to="/cenik" className="text-primary hover:underline">/cenik</Link>.
          </p>
          <p className="mt-2">
            Provozovatel není realitní zprostředkovatel ani vlastník inzerovaných nemovitostí.
            Zobrazené údaje pocházejí ze třetích stran a Provozovatel neručí za jejich aktuálnost
            ani správnost. Investiční rozhodnutí činí uživatel na vlastní odpovědnost.
          </p>
        </Section>

        <Section title="3. Registrace a uživatelský účet">
          <p>
            Pro využití části Služby je nutná registrace e-mailem.
            Uživatel se zavazuje uvádět pravdivé údaje a chránit přístupové údaje ke svému účtu.
          </p>
        </Section>

        <Section title="4. Platby přes Stripe">
          <p>
            Platby za předplatné Premium zpracovává společnost <strong>Stripe Payments Europe, Ltd.</strong>
            Provozovatel nemá přístup k platebním údajům (číslo karty apod.) — ty jsou zpracovávány
            výhradně poskytovatelem platebních služeb v souladu s jeho podmínkami
            (<a href="https://stripe.com/legal/consumer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">stripe.com/legal</a>).
          </p>
          <p className="mt-2">
            Předplatné je opakovaná platba s automatickým obnovením (měsíčně 349 Kč nebo ročně 3 490 Kč).
            Cena je uvedena včetně případné DPH dle aktuální legislativy. Uživatel může předplatné
            kdykoliv zrušit ve své zákaznické sekci („Správa předplatného“); předplatné poté
            doběhne do konce již zaplaceného období a dál se neobnovuje.
          </p>
        </Section>

        <Section title="5. Odstoupení od smlouvy">
          <p>
            Provozovatel neposkytuje dobrovolnou garanci vrácení peněz bez udání důvodu.
            Tím nejsou omezena zákonná práva spotřebitele, včetně práva odstoupit od smlouvy
            v případech a lhůtách stanovených zákonem. Samotné přihlášení nebo aktivace
            předplatného se nepovažuje za vzdání se těchto práv.
          </p>
          <p className="mt-2">
            Pro uplatnění odstoupení nebo reklamace napište na <a className="text-primary hover:underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
            Uveďte e-mail účtu, datum objednávky a svůj požadavek; číslo platební karty neposílejte.
            Zrušení automatického obnovování ve Stripe samo o sobě neznamená žádost o vrácení platby.
          </p>
        </Section>

        <Section title="6. Omezení odpovědnosti">
          <p>
            Služba je poskytována „tak jak je“. Provozovatel neručí za škodu vzniklou v důsledku
            chyb v datech ze třetích portálů, nedostupnosti Služby ani investičních rozhodnutí
            uživatele. Toto ustanovení nevylučuje odpovědnost, kterou nelze podle zákona vyloučit,
            ani zákonná práva z vadného plnění.
          </p>
        </Section>

        <Section title="7. Ukončení">
          <p>
            Provozovatel může účet ukončit při porušení těchto podmínek (zejména pokus o obejití
            limitů, scraping, zneužití). Uživatel může účet kdykoliv smazat zasláním požadavku
            na kontaktní e-mail.
          </p>
        </Section>

        <Section title="8. Závěrečná ustanovení">
          <p>
            Tyto podmínky se řídí právním řádem České republiky. Provozovatel je oprávněn podmínky
            jednostranně měnit; o změnách bude uživatele informovat e-mailem nebo v aplikaci.
          </p>
          <p>Spotřebitel se může s návrhem na mimosoudní řešení spotřebitelského sporu obrátit
            na Českou obchodní inspekci, Ústřední inspektorát – oddělení ADR, Štěpánská 567/15,
            120 00 Praha 2: <a href="https://coi.gov.cz/informace-o-adr/" className="text-primary hover:underline">informace o ADR</a>.
          </p>
        </Section>

        <p className="mt-10 text-xs text-muted-foreground">
          Viz též <Link to="/ochrana-osobnich-udaju" className="text-primary hover:underline">Ochrana osobních údajů</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
