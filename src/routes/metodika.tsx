import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/metodika")({
  head: () => ({
    meta: [
      { title: "Metodika výpočtu výnosu — RealityScanner" },
      { name: "description", content: "Jak počítáme hrubý a čistý výnos z pronájmu, návratnost a hodnocení investice. Transparentní vzorce a zdroje dat." },
    ],
  }),
  component: Metodika,
});

function Metodika() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zpět na skener
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Metodika výpočtu výnosu</h1>
        <p className="mt-3 text-muted-foreground">
          Vysvětlujeme přesně, jak u každého inzerátu odhadujeme měsíční nájem, jak z toho
          počítáme hrubý a čistý výnos, návratnost a jakými prahy klasifikujeme atraktivitu
          investice. Vzorce odpovídají skutečné implementaci.
        </p>

        <Section title="1. Odhad měsíčního tržního nájmu">
          <p>
            Inzeráty na prodej obvykle neobsahují informaci o očekávaném nájmu. Proto ho
            modelujeme ze srovnatelných pronájmů. Postup je hybridní a vždy bere
            nejpřesnější dostupný zdroj:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              <strong>Srovnatelné aktivní pronájmy v naší databázi</strong> — pokud najdeme
              alespoň <strong>5 inzerátů</strong> se stejným krajem, stejným typem
              nemovitosti a plochou v rozpětí <strong>± 20 %</strong>, vezmeme medián
              jejich měsíčního nájmu. Toto je nejpřesnější zdroj a používáme ho přednostně.
            </li>
            <li>
              <strong>Pražské obvody, Brno-části, Plzeň 1–4, Ostrava-části</strong> — pevná
              tabulka Kč/m² měsíčně pro městské části velkých měst (např. Praha 1 = 510,
              Praha 9 = 360, Brno-střed = 380 Kč/m²). Zdroj: Deloitte Rent Index 2024 +
              kalibrace na Sreality 2024/2025.
            </li>
            <li>
              <strong>Okres (77 okresů ČR)</strong> — <strong>živý medián</strong> Kč/m²
              vypočtený 1× za 24 hodin z ~500 aktivních inzerátů pronájmu bytů ze Sreality.
              Okres musí mít alespoň <strong>8 vzorků</strong> (sanity rozsah 80–900
              Kč/m²), jinak padáme na statický odhad pro daný okres (Deloitte 2024 + ČSÚ).
            </li>
            <li>
              <strong>Kraj</strong> — krajský průměr Kč/m² (např. Praha 415, Jihomoravský
              330, Ústecký 195 Kč/m²).
            </li>
            <li>
              <strong>ČR průměr</strong> — záchranná hodnota 270 Kč/m², když nelze určit
              ani kraj.
            </li>
          </ol>

          <h3 className="mt-5 font-semibold text-foreground">Korekce sazby Kč/m²</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Typ nemovitosti: <em>domy × 0,8</em>, <em>komerční × 0,9</em>, byty × 1,0.</li>
            <li>
              Dispozice bytu (malé byty mají vyšší Kč/m²): 1+kk / garsoniéra <em>× 1,15</em>,
              2+kk <em>× 1,05</em>, 3+kk <em>× 1,0</em>, 4+kk <em>× 0,95</em>, 5+kk a větší
              <em> × 0,9</em>.
            </li>
            <li>
              Družstevní byt: výsledný měsíční nájem <em>× 0,92</em> (mírná penalizace
              kvůli omezením a horšímu refinancování).
            </li>
            <li>
              Garáž / parkovací stání: pevná částka podle kraje (Praha 3 500 Kč,
              ČR průměr 2 200 Kč měsíčně).
            </li>
          </ul>

          <h3 className="mt-5 font-semibold text-foreground">Měsíční nájem v Kč</h3>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-[var(--color-surface-2)] p-3 text-xs">
{`monthly_rent = Kč_za_m² × plocha_m²
            × typ_mult × dispozice_mult
            × (družstevní ? 0.92 : 1.0)`}
          </pre>
          <p className="mt-2 text-muted-foreground">
            Pokud chybí plocha bytu, doplníme typický průměr (byty 55 m², domy 130 m²,
            komerční 80 m²) — to označujeme v rozpadu jako fallback.
          </p>
        </Section>

        <Section title="2. Hrubý výnos (gross yield)">
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-[var(--color-surface-2)] p-3 text-xs">
{`gross_yield [%] = (monthly_rent × 12) / cena × 100`}
          </pre>
          <p className="mt-2 text-muted-foreground">
            Tedy roční nájem dělený kupní cenou. U družstevních bytů s detekovanou anuitou
            používáme „efektivní cenu&nbsp;=&nbsp;cena&nbsp;+&nbsp;nesplacený úvěr družstva“,
            aby srovnání s OV bylo férové.
          </p>
        </Section>

        <Section title="3. Čistý výnos (net yield) — paušální srážka 15 %">
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-[var(--color-surface-2)] p-3 text-xs">
{`net_yield [%] = gross_yield × 0.85`}
          </pre>
          <p className="mt-2">
            Z hrubého výnosu odečítáme paušálních <strong>15 %</strong> jako odhad
            provozních nákladů a ztrát, které majitele typicky čekají. Tato srážka
            pokrývá:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>daň z nemovitých věcí</li>
            <li>pojištění nemovitosti</li>
            <li>příspěvek do SVJ / fondu oprav (u OV bytů)</li>
            <li>správu, inzerci a obsazování nájemníky</li>
            <li>průměrnou neobsazenost (~1 měsíc / 2 roky)</li>
            <li>drobné opravy a běžnou údržbu</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            15 % je záměrně střízlivý paušál pro rychlé srovnání. Reálná čísla se liší
            podle stavu domu, stáří bytu a kvality nájemníka. Hypoteční splátky <strong>nejsou</strong> v
            srážce zahrnuté — výnos vyjadřuje výkonnost nemovitosti samotné, nikoli vaší
            konkrétní financovací struktury.
          </p>
        </Section>

        <Section title="4. Návratnost (payback)">
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-[var(--color-surface-2)] p-3 text-xs">
{`payback_years = cena / (monthly_rent × 12)`}
          </pre>
          <p className="mt-2 text-muted-foreground">
            Kolik let čistého ročního nájmu (bez srážky) by teoreticky pokrylo pořizovací
            cenu. Slouží jako intuitivní převod hrubého výnosu na „roky“ — neuvažuje
            inflaci, růst nájmů ani daně.
          </p>
        </Section>

        <Section title="5. Hodnocení investice (hvězdičky)">
          <p>Atraktivita se klasifikuje podle <strong>čistého</strong> výnosu:</p>
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left">
              <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Net yield</th>
                  <th className="px-3 py-2">Hodnocení</th>
                  <th className="px-3 py-2">Hvězdiček</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <Row a="≥ 6 %" b="Výborná investice 🏆" c="5★" />
                <Row a="5 – 5,99 %" b="Dobrá investice ✅" c="4★" />
                <Row a="4 – 4,99 %" b="Průměrný výnos ⚖️" c="3★" />
                <Row a="3 – 3,99 %" b="Podprůměrné ⚠️" c="2★" />
                <Row a="< 3 %" b="Nevýhodné ❌" c="1★" />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-muted-foreground">
            Prahy jsou kalibrované na český trh 2024/2025, kde se čistý výnos u
            standardních bytů pohybuje typicky mezi 3 a 5 %. Hodnoty ≥ 6 % zpravidla
            znamenají buď výrazně podhodnocenou cenu, nebo specifické riziko (lokalita,
            stav, družstvo s anuitou) — vždy si je ověřte ručně.
          </p>
        </Section>

        <Section title="6. Co metodika neumí a kde dělá kompromisy">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Nevidí dovnitř nemovitosti — stav, rekonstrukce, orientaci, patro ani výhled.
              Odhad nájmu je tržní průměr pro danou plochu a lokalitu.
            </li>
            <li>
              Neumí výjimečné nemovitosti (luxusní byty, historické vily) — sjede k
              průměru, takže výnos podhodnotí nebo nadhodnotí.
            </li>
            <li>
              Nepočítá s konkrétní hypotékou, daní z příjmu z pronájmu (15 %) ani s
              odpisy. Slouží pro <em>screening</em>, nikoli pro finální investiční model.
            </li>
            <li>
              Anuita u družstevních bytů se detekuje z textu inzerátu — pokud částka v
              inzerátu chybí, efektivní cena nemusí odpovídat realitě.
            </li>
          </ul>
        </Section>

        <Section title="7. Cena za m² vs. průměr srovnatelných">
          <p>
            U každého inzerátu porovnáváme jeho nabídkovou cenu za m² s <strong>mediánem
            srovnatelných aktivních inzerátů</strong> v naší databázi. Srovnatelný znamená:
            stejný typ nemovitosti (byty se porovnávají jen s byty, domy jen s domy — nikdy
            se nemíchají), stejná lokalita a podlahová plocha v rozpětí <strong>± 25 %</strong>.
          </p>
          <p className="mt-2">
            Lokalitu zužujeme postupně: nejdřív <strong>okres</strong> inzerátu, pak{" "}
            <strong>kraj</strong>, nakonec <strong>celá ČR</strong>. V každém kroku
            potřebujeme alespoň <strong>5 srovnatelných</strong> nabídek; pokud jich není
            dost ani celorepublikově, zobrazíme „nedostatek dat pro srovnání" místo čísla.
            U každé hodnoty uvádíme počet vzorků (např. „medián z 18 srovnatelných").
          </p>
          <p className="mt-2">
            Pásma: pod <strong>−10 %</strong> = levnější než průměr, v rozmezí{" "}
            <strong>± 10 %</strong> = v průměru, nad <strong>+10 %</strong> = dražší než
            průměr.
          </p>
        </Section>

        <Section title="8. Proč u domů nepočítáme nájemní výnos">
          <p>
            Pro rodinné domy neexistují spolehlivá srovnatelná data o nájmech — trh s
            pronájmy domů je řádově menší a velmi nesourodý. Aplikovat na dům sazby
            odvozené z nájmů bytů by dávalo nesmyslné „nájmy" a zavádějící výnosy. Proto u
            domů <strong>nezobrazujeme</strong> odhad nájmu, výnos ani hvězdičkové
            hodnocení investice; hlavní metrikou je <strong>cena za m² vs. průměr</strong>.
          </p>
          <p className="mt-2">
            <strong>Pozor:</strong> u domů je cena za m² podlahové plochy silně ovlivněna
            velikostí pozemku — velká parcela zvedá celkovou cenu, i když je dům samotný
            malý. Metrika je proto pouze hrubý screeningový signál, ne ocenění. Plochu
            pozemku zobrazujeme u karty tam, kde ji zdroj uvádí.
          </p>
          <p className="mt-2">
            Srovnání domů je výrazně méně spolehlivé než u bytů: domy se liší velikostí
            pozemku, technickým stavem i tím, zda jde o novostavbu nebo nemovitost k
            rekonstrukci, a v jednotlivých regionech je navíc málo skutečně srovnatelných
            nabídek. Výsledek proto berte jako hrubý screeningový signál, nikoli ocenění.
          </p>
        </Section>


        <div className="mt-10 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-amber-200/90">
          <strong>Upozornění:</strong> Všechny výpočty na RealityScanneru jsou orientační
          odhady určené k rychlému předvýběru (screeningu) inzerátů. Nejedná se o
          investiční doporučení, ocenění ani znalecký posudek. Před nákupem si nemovitost
          vždy ověřte fyzicky, prověřte právní stav (LV, věcná břemena, anuitu u družstva)
          a propočtěte si vlastní model s reálnou hypotékou a daňovou situací.
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2 text-foreground/90">{children}</div>
    </section>
  );
}

function Row({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-xs">{a}</td>
      <td className="px-3 py-2">{b}</td>
      <td className="px-3 py-2 text-primary">{c}</td>
    </tr>
  );
}
