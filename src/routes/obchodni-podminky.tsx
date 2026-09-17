import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/obchodni-podminky")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Obchodní podmínky — RealityScanner" },
      { name: "description", content: "Obchodní podmínky služby RealityScanner." },
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
        <p className="mt-2 text-sm text-muted-foreground">
          Účinné od: <em>[DATUM ÚČINNOSTI — DOPLNIT]</em>
        </p>

        <Section title="1. Provozovatel">
          <Placeholder>
            Jméno / obchodní firma: [DOPLNIT]<br />
            IČO: [DOPLNIT]<br />
            DIČ: [DOPLNIT / nejsem plátce DPH]<br />
            Sídlo: [DOPLNIT]<br />
            Zápis: [DOPLNIT — např. živnostenský rejstřík / OR vedený u …]<br />
            Kontakt: [E-MAIL] · [TELEFON nepovinné]
          </Placeholder>
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
            Pro využití části Služby je nutná registrace e-mailem nebo přihlášení přes Google.
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
            Aktivací předplatného Premium spotřebitel výslovně souhlasí se zahájením plnění před
            uplynutím lhůty pro odstoupení od smlouvy a bere na vědomí, že tímto ztrácí právo
            odstoupit od smlouvy dle § 1837 písm. l) občanského zákoníku.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            [Doplnit individuální politiku vracení peněz, pokud chcete být vstřícnější než zákon vyžaduje.]
          </p>
        </Section>

        <Section title="6. Omezení odpovědnosti">
          <p>
            Služba je poskytována „tak jak je“. Provozovatel neručí za škodu vzniklou v důsledku
            chyb v datech ze třetích portálů, nedostupnosti Služby ani investičních rozhodnutí
            uživatele.
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
        </Section>

        <p className="mt-10 text-xs text-muted-foreground">
          Viz též <Link to="/ochrana-osobnich-udaju" className="text-primary hover:underline">Ochrana osobních údajů</Link>.
        </p>
      </main>
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

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-foreground">
      {children}
    </div>
  );
}
