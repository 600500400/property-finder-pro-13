import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { OperatorDetails } from "@/components/OperatorDetails";
import { OPERATOR } from "@/lib/site";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/ochrana-osobnich-udaju")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Ochrana osobních údajů — RealityScanner" },
      {
        name: "description",
        content:
          "Zásady zpracování osobních údajů (GDPR) ve službě RealityScanner: jaká data ukládáme a jak je chráníme.",
      },
      // Public legal information, excluded from acquisition search results.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Ochrana osobních údajů — RealityScanner" },
      {
        property: "og:description",
        content:
          "Jaká osobní data RealityScanner zpracovává, jak dlouho je uchovává a jaká máte práva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Ochrana osobních údajů — RealityScanner" },
      {
        name: "twitter:description",
        content: "Jaká osobní data RealityScanner zpracovává a jaká máte práva.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Zpět
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Ochrana osobních údajů</h1>

        <Section title="1. Správce osobních údajů">
          <OperatorDetails />
        </Section>

        <Section title="2. Jaké údaje zpracováváme">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Účet:</strong> e-mailová adresa, ID uživatele, datum registrace, autentizační
              tokeny.
            </li>
            <li>
              <strong>Předplatné:</strong> Stripe customer ID, Stripe subscription ID, stav
              předplatného, datum konce platebního období. Číslo karty <em>nikdy</em> nezpracováváme
              — drží Stripe.
            </li>
            <li>
              <strong>Užívání služby:</strong> uložené vyhledávací filtry a hlídací psi, historie
              zobrazených inzerátů (pro účely doručení upozornění).
            </li>
            <li>
              <strong>Technické údaje:</strong> IP adresa, User-Agent, časy přístupů (logy serveru).
            </li>
            <li>
              <strong>AI analýzy:</strong> uživatelská investiční pravidla, identifikátor nabídky,
              výsledek a evidence spotřeby analýz. Osobní investiční pravidla nevkládejte do
              veřejných inzerátů.
            </li>
            <li>
              <strong>Analytika po souhlasu:</strong> online identifikátory, navštívené stránky,
              události používání služby, zdroj návštěvy a informace o zařízení v Google Analytics 4.
              Do vlastních analytických událostí nevkládáme e-mail, ID účtu ani obsah investičních
              pravidel.
            </li>
          </ul>
        </Section>

        <Section title="3. Účely a právní základ zpracování">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Poskytování Služby</strong> (čl. 6 odst. 1 písm. b) GDPR — plnění smlouvy).
            </li>
            <li>
              <strong>Platby a vedení účetnictví</strong> (čl. 6 odst. 1 písm. c) GDPR — plnění
              právní povinnosti).
            </li>
            <li>
              <strong>E-mailová upozornění</strong> na nové inzeráty (plnění smlouvy / oprávněný
              zájem dle nastavení hlídacích psů uživatelem).
            </li>
            <li>
              <strong>Bezpečnost a prevence zneužití</strong> (oprávněný zájem).
            </li>
            <li>
              <strong>Měření návštěvnosti a používání webu</strong> prostřednictvím Google Analytics
              (souhlas, čl. 6 odst. 1 písm. a) GDPR). Souhlas je dobrovolný a lze ho odvolat přes
              „Nastavení cookies“.
            </li>
          </ul>
        </Section>

        <Section title="4. Příjemci údajů (zpracovatelé)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong> (hosting databáze a autentizace).
            </li>
            <li>
              <strong>Stripe Payments Europe, Ltd.</strong> (zpracování plateb).
            </li>
            <li>
              <strong>Resend</strong> (odesílání transakčních e-mailů).
            </li>
            <li>
              <strong>Cloudflare</strong> (hostingová a CDN infrastruktura).
            </li>
            <li>
              <strong>Lovable / Supabase Edge</strong> (serverless běhové prostředí).
            </li>
            <li>
              <strong>Google Ireland Limited</strong> (Google Analytics 4, pouze po povolení
              analytiky). Google může údaje zpracovávat také mimo Evropský hospodářský prostor.
              Podrobnosti uvádějí{" "}
              <a
                href="https://policies.google.com/privacy?hl=cs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                zásady ochrany soukromí Google
              </a>
              .
            </li>
          </ul>
          <p className="mt-2">
            Informace o konkrétních zpracovatelích, místě zpracování a zárukách případného předávání
            mimo EU poskytne správce na kontaktním e-mailu. AI analýza využívá externího
            poskytovatele prostřednictvím serveru aplikace; do analýzy nezadávejte citlivé osobní
            údaje.
          </p>
        </Section>

        <Section title="5. Doba uchování">
          <p>
            Údaje účtu uchováváme po dobu existence účtu. Účetní a daňové doklady spojené s platbami
            uchováváme po zákonnou dobu (až 10 let). Logy serveru max. 90 dní.
          </p>
        </Section>

        <Section title="6. Vaše práva (GDPR)">
          <ul className="list-disc space-y-1 pl-5">
            <li>Právo na přístup ke svým údajům.</li>
            <li>Právo na opravu nepřesných údajů.</li>
            <li>
              <strong>Právo na výmaz („být zapomenut“)</strong> — zašlete žádost na kontaktní e-mail
              a údaje budou smazány v rozsahu, který neodporuje zákonné povinnosti uchování.
            </li>
            <li>Právo na omezení zpracování.</li>
            <li>Právo na přenositelnost údajů.</li>
            <li>Právo vznést námitku proti zpracování na základě oprávněného zájmu.</li>
            <li>
              Právo podat stížnost u Úřadu pro ochranu osobních údajů (
              <a
                href="https://www.uoou.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                uoou.cz
              </a>
              ).
            </li>
          </ul>
        </Section>

        <Section title="7. Cookies">
          <p id="cookies">
            Pro přihlášení, nastavení filtrů a zapamatování Vaší volby používáme nezbytné úložiště
            prohlížeče. Google Analytics 4 se načte až po výslovném povolení analytiky. Před touto
            volbou ani po odmítnutí aplikace Google Analytics nenačítá. Reklamní funkce Google jsou
            vypnuté.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="py-2 text-left font-semibold">
                Cookies a místní úložiště používané aplikací
              </caption>
              <thead>
                <tr>
                  <th className="p-2">Název / účel</th>
                  <th className="p-2">Typ</th>
                  <th className="p-2">Doba</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2">sb-…-auth-token · přihlášení (Supabase)</td>
                  <td className="p-2">Nezbytné místní úložiště</td>
                  <td className="p-2">
                    Do odhlášení nebo zániku relace; přihlašovací tokeny se obnovují
                  </td>
                </tr>
                <tr>
                  <td className="p-2">
                    realityscanner.lastFilters / lastView · Vaše filtry a zobrazení
                  </td>
                  <td className="p-2">Místní úložiště nastavení</td>
                  <td className="p-2">Do změny nebo vymazání úložiště</td>
                </tr>
                <tr>
                  <td className="p-2">
                    realityscanner.cookie-consent.v1 · volba, čas a verze souhlasu
                  </td>
                  <td className="p-2">Nezbytné místní úložiště</td>
                  <td className="p-2">Platnost volby 180 dní; potom je nutná nová volba</td>
                </tr>
                <tr>
                  <td className="p-2">
                    _ga, _ga_… · rozlišení návštěv a statistiky Google Analytics
                  </td>
                  <td className="p-2">Analytické cookies, pouze po souhlasu</td>
                  <td className="p-2">
                    Aplikace nastavuje platnost nejvýše 180 dní bez automatického prodlužování
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Odmítnutí analytiky neomezuje používání služby. Volbu kdykoli změníte tlačítkem
            „Nastavení cookies“ vlevo dole. Po odvolání souhlasu aplikace zastaví analytiku,
            odstraní dostupné cookies Google Analytics a obnoví stránku. Přihlášení a uložené filtry
            zůstanou zachovány. Odvolání nemá zpětný vliv na zpracování provedené před jeho
            odvoláním.
          </p>
        </Section>

        <Section title="8. Kontakt">
          <p>
            Veškeré dotazy ke zpracování osobních údajů zasílejte na:
            <br />
            <a className="text-primary hover:underline" href={`mailto:${OPERATOR.email}`}>
              {OPERATOR.email}
            </a>
          </p>
        </Section>

        <p className="mt-10 text-xs text-muted-foreground">
          Viz též{" "}
          <Link to="/obchodni-podminky" className="text-primary hover:underline">
            Obchodní podmínky
          </Link>
          .
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
