import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Home, Building2, Calculator, ShieldCheck, HelpCircle, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { getCsuCalibration } from "@/lib/listings/csu-public.functions";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Jak přesně RealityScanner odhaduje tržní měsíční nájem?",
    a: "Tržní nájem modelujeme kaskádově. Přednostně bereme medián skutečných aktivních pronájmů v naší databázi v daném kraji u nemovitostí podobné velikosti (± 20 %, min. 5 vzorků). Pokud vzorky chybí, využíváme denně aktualizovaný medián okresu ze Sreality (kalibrovaný na Deloitte Rent Index a ČSÚ). Výslednou sazbu korigujeme podle dispozice (garsonky mají vyšší cenu za m², velké byty nižší) a u družstevních bytů zohledňujeme 8% diskont kvůli omezením."
  },
  {
    q: "Co všechno pokrývá 15% paušální srážka u čistého výnosu?",
    a: "Srážka pokrývá běžné provozní náklady majitele a ztráty, které nelze přenést na nájemníka: příspěvek do fondu oprav / SVJ, daň z nemovitých věcí, pojištění nemovitosti, náklady na inzerci a správu, drobné opravy a průměrnou neobsazenost (cca 1 měsíc za 2 roky). Srážka záměrně neobsahuje hypoteční splátky, protože výnos vyjadřuje výkonnost nemovitosti samotné bez ohledu na způsob financování."
  },
  {
    q: "Proč u rodinných domů nepočítáte nájemní výnos jako u bytů?",
    a: "Na rozdíl od bytů se rodinné domy v ČR pronajímají jen minimálně a nabídka je příliš různorodá. Modelovat fiktivní nájem rodinného domu z dat o bytech by vedlo k nereálným číslům. Místo toho u domů srovnáváme reálnou nabídkovou cenu za m² se skutečně realizovanými kupními cenami z databáze Českého statistického úřadu (ČSÚ) pro daný okres a velikostní kategorii."
  },
  {
    q: "Jak pracujete s anuitou u družstevních bytů?",
    a: "Pokud inzerát zmiňuje nesplacenou anuitu nebo úvěr družstva, částku automaticky detekujeme a přičítáme ke kupní ceně (tzv. efektivní pořizovací cena). Díky tomu je srovnání výnosnosti družstevního bytu s bytem v osobním vlastnictví objektivní a odpovídá reálným nákladům na pořízení."
  },
  {
    q: "Z jakých realitních portálů inzeráty stahujete a jak často?",
    a: "Agregujeme inzeráty ze 4 hlavních portálů: Sreality, Bezrealitky, Bazoš a iDnes Reality. Nové inzeráty monitorujeme v reálném čase, data aktualizujeme každých 15 minut a denně přepočítáváme cenové mediány ve všech 77 okresech ČR."
  },
  {
    q: "Nahrazuje RealityScanner fyzickou prohlídku nebo znalecký posudek?",
    a: "Určitě ne. RealityScanner slouží pro rychlý screening a filtrování tisíců nabídek, abyste během vteřiny poznali, které inzeráty mají investiční potenciál a které jsou předražené. Před samotným nákupem si nemovitost vždy prověřte osobně, zkontrolujte technický stav i list vlastnictví v katastru (LV) a spočítejte si vlastní model s konkrétní hypotékou a daňovou situací."
  }
];

export const Route = createFileRoute("/metodika")({
  staticData: { sitemap: true },
  loader: () => getCsuCalibration(),
  head: () => ({
    meta: [
      { title: "Metodika výpočtu výnosu a ocenění nemovitostí | RealityScanner" },
      { name: "description", content: "Jak přesně počítáme hrubý a čistý výnos z pronájmu, návratnost a srovnání cen rodinných domů vůči realizovaným kupním cenám ČSÚ. Transparentní vzorce a metodika." },
      { property: "og:title", content: "Metodika výpočtu výnosu a ocenění nemovitostí | RealityScanner" },
      { property: "og:description", content: "Jak přesně počítáme hrubý a čistý výnos z pronájmu, návratnost a srovnání cen domů s ČSÚ." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.realityscanner.cz/metodika" },
      { property: "og:image", content: "https://www.realityscanner.cz/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
      { name: "twitter:title", content: "Metodika výpočtu výnosu a ocenění nemovitostí | RealityScanner" },
      { name: "twitter:description", content: "Jak přesně počítáme hrubý a čistý výnos z pronájmu, návratnost a srovnání cen domů s ČSÚ." },
      { name: "twitter:image", content: "https://www.realityscanner.cz/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.realityscanner.cz/metodika" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": item.a,
            },
          })),
        }),
      },
    ],
  }),
  component: Metodika,
});

function Metodika() {
  Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zpět na skener
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 text-sm leading-relaxed">
        {/* HERO TITLE */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Calculator className="h-3.5 w-3.5" /> Transparentní metodika
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Jak počítáme výnosy a hodnotíme nemovitosti
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground">
            Žádná „černá skříňka“ ani náhodné odhady. Vysvětlujeme krok za krokem, jak u každého inzerátu
            modelujeme tržní nájem, jak kalkulujeme čistý výnos a jak srovnáváme ceny rodinných domů
            s oficiálními realizovanými prodeji Českého statistického úřadu (ČSÚ).
          </p>
        </div>

        {/* TL;DR SHRNUTÍ VE 3 KARTÁCH */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">1. Odhad nájmu</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Vycházíme z mediánu skutečných pronájmů v lokalitě a sazbu za m² upravujeme podle dispozice a typu vlastnictví.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">2. Čistý výnos</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Z hrubého výnosu střízlivě odečítáme 15 % na fond oprav, daň z nemovitostí, správu a rezervu na neobsazenost.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Home className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">3. Domy a ČSÚ</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              U domů nevymýšlíme fiktivní nájem. Porovnáváme pořizovací cenu za m² se skutečně realizovanými kupními cenami ČSÚ.
            </p>
          </div>
        </div>

        {/* SEKCIE 1: BYTY A VÝNOS Z NÁJMU */}
        <div className="mt-12 space-y-6">
          <div className="border-b border-border pb-2">
            <h2 className="text-2xl font-bold text-foreground">
              1. Výpočet výnosu z nájmu u bytů
            </h2>
            <p className="text-xs text-muted-foreground">
              Jak u každého bytu zjistíme odhad nájmu, hrubý a čistý výnos a návratnost v letech.
            </p>
          </div>

          {/* KROK A: TRŽNÍ NÁJEM */}
          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-5">
            <h3 className="text-base font-semibold text-foreground">
              A) Jak určujeme tržní měsíční nájem?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Inzeráty na prodej výši nájmu neuvádějí. Náš model proto nájem odhaduje hybridním postupem z reálných nabídek pronájmu:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground/90">
              <li>
                <strong>Přímé srovnání v lokalitě:</strong> Pokud v databázi najdeme alespoň 5 aktivních pronájmů ve stejném kraji a s plochou v rozmezí ± 20 %, vezmeme medián jejich nájmu. Toto je nejpřesnější hodnota.
              </li>
              <li>
                <strong>Cenové mapy velkých měst:</strong> Pro městské části Prahy, Brna, Plzně a Ostravy máme přesné sazby Kč/m² (např. Praha 1 = 510 Kč/m², Praha 9 = 360 Kč/m², Brno-střed = 380 Kč/m²) kalibrované na Deloitte Rent Index a Sreality.
              </li>
              <li>
                <strong>Denní medián v 77 okresech ČR:</strong> Každých 24 hodin počítáme živý medián Kč/m² z inzerátů pronájmů v každém okrese (při min. 8 vzorcích).
              </li>
              <li>
                <strong>Krajský a celorepublikový průměr:</strong> Záložní hodnoty, pokud pro danou menší lokalitu není k dispozici dostatek čerstvých inzerátů pronájmů.
              </li>
            </ol>

            <div className="mt-4 rounded-lg border border-border bg-[var(--color-surface-2)] p-3.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Korekce základní sazby Kč/m²:
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <div>• <strong>1+kk / garsoniéra:</strong> +15 % (menší byty dosahují vyššího nájmu na m²)</div>
                <div>• <strong>2+kk:</strong> +5 % k sazbě za m²</div>
                <div>• <strong>3+kk:</strong> standardní sazba (100 %)</div>
                <div>• <strong>4+kk a větší:</strong> −5 % až −10 % k sazbě za m²</div>
                <div>• <strong>Družstevní byt:</strong> −8 % (zohledňuje omezení pronájmu v družstvu)</div>
                <div>• <strong>Garáž / parkovací stání:</strong> pevná částka (Praha 3 500 Kč, ČR 2 200 Kč)</div>
              </div>
            </div>
          </div>

          {/* KROK B: VZORCE A PŘÍKLAD */}
          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-5">
            <h3 className="text-base font-semibold text-foreground">
              B) Hrubý výnos, čistý výnos a návratnost
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-[var(--color-surface-2)] p-3.5">
                <div className="text-xs font-bold text-primary uppercase">Hrubý výnos (Gross Yield)</div>
                <div className="mt-1 font-mono text-sm font-semibold">roční nájem ÷ kupní cena × 100</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Základní ukazatel: kolik procent z pořizovací ceny nemovitost vygeneruje na nájmu za jeden rok (před započtením nákladů).
                </p>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <div className="text-xs font-bold text-emerald-400 uppercase">Čistý výnos (Net Yield)</div>
                <div className="mt-1 font-mono text-sm font-semibold">hrubý výnos × 0,85</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Realistický pohled pro investora: z hrubého nájmu střízlivě odečítáme 15% paušál na nezbytné provozní náklady a neobsazenost.
                </p>
              </div>
            </div>

            {/* PRAKTICKÝ PŘÍKLAD ZE ŽIVOTA */}
            <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" /> Praktický příklad: Jak výpočet vypadá v praxi
              </div>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Byt 2+kk v Brně:</span>
                  <div className="font-semibold text-foreground">50 m² · Osobní vlastnictví</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Kupní cena:</span>
                  <div className="font-mono font-bold text-foreground">4 500 000 Kč</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tržní nájem:</span>
                  <div className="font-mono font-bold text-foreground">16 000 Kč / měsíc</div>
                  <div className="text-[10px] text-muted-foreground">(192 000 Kč ročně)</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Výsledek v RealityScanneru:</span>
                  <div className="font-mono text-sm font-bold text-emerald-400">Čistý výnos 3,6 %</div>
                  <div className="text-[10px] text-muted-foreground">Hrubý 4,3 % · Návratnost 23,4 let</div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              <strong>Proč paušální srážka 15 %?</strong> Pokrývá fond oprav a příspěvek do SVJ, daň z nemovitých věcí, pojištění nemovitosti, náklady na inzerci, správu, drobné opravy a rezervu na neobsazenost (typicky 1 měsíc za 2 roky). Hypoteční splátky v srážce <em>nejsou</em>, protože výnos vyjadřuje výkonnost nemovitosti samotné bez ohledu na způsob financování.
            </div>
          </div>

          {/* KROK C: ŠKÁLA HVĚZDIČEK */}
          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-5">
            <h3 className="text-base font-semibold text-foreground">
              C) Jak hodnotíme atraktivitu investice (hvězdičky)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Klasifikace vychází z českého realitního trhu v letech 2024–2026, kde se běžný čistý výnos standardních bytů pohybuje mezi 3 a 5 %:
            </p>

            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-[var(--color-surface-2)] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Čistý výnos</th>
                    <th className="px-3 py-2">Slovní verdikt</th>
                    <th className="px-3 py-2">Hodnocení</th>
                    <th className="px-3 py-2">Co to znamená pro investora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  <tr>
                    <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">≥ 6,0 %</td>
                    <td className="px-3 py-2.5 font-semibold">Výborná investice 🏆</td>
                    <td className="px-3 py-2.5 text-primary">★★★★★</td>
                    <td className="px-3 py-2.5 text-muted-foreground">Mimořádně atraktivní nabídka nebo podhodnocená cena. Prověřte technický stav a právní vady.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-mono font-bold text-emerald-300">5,0 – 5,99 %</td>
                    <td className="px-3 py-2.5 font-semibold">Dobrá investice ✅</td>
                    <td className="px-3 py-2.5 text-primary">★★★★☆</td>
                    <td className="px-3 py-2.5 text-muted-foreground">Nadprůměrný výnos pro daný region, vysoký potenciál cashflow.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-300">4,0 – 4,99 %</td>
                    <td className="px-3 py-2.5 font-semibold">Průměrný výnos ⚖️</td>
                    <td className="px-3 py-2.5 text-primary">★★★☆☆</td>
                    <td className="px-3 py-2.5 text-muted-foreground">Běžný tržní standard ve větších městech. Vhodné pro stabilní uchování hodnoty.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-500">3,0 – 3,99 %</td>
                    <td className="px-3 py-2.5 font-semibold">Podprůměrné ⚠️</td>
                    <td className="px-3 py-2.5 text-primary">★★☆☆☆</td>
                    <td className="px-3 py-2.5 text-muted-foreground">Nižší nájemní výnos (typicky novostavby v Praze a Brně). Zhodnocení závisí na růstu ceny.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-mono font-bold text-red-400">&lt; 3,0 %</td>
                    <td className="px-3 py-2.5 font-semibold">Nevýhodné ❌</td>
                    <td className="px-3 py-2.5 text-primary">★☆☆☆☆</td>
                    <td className="px-3 py-2.5 text-muted-foreground">Z pohledu nájemního výnosu předražená nabídka. Nájem nepokryje ani základní náklady.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SEKCIE 2: RODINNÉ DOMY A ČSÚ */}
        <div className="mt-12 space-y-6">
          <div className="border-b border-border pb-2">
            <h2 className="text-2xl font-bold text-foreground">
              2. Ocenění rodinných domů (Srovnání s ČSÚ a trhem)
            </h2>
            <p className="text-xs text-muted-foreground">
              Proč u domů nepočítáme nájem a jak poznáte, zda je dům v dané lokalitě levný nebo drahý.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-5">
            <h3 className="text-base font-semibold text-foreground">
              Proč u rodinných domů nepočítáme nájemní výnos?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Na rozdíl od bytů se rodinné domy v České republice pronajímají jen minimálně a nabídka je příliš různorodá. Modelovat fiktivní „nájem domu“ z dat o bytech by vedlo k nereálným číslům a zkresleným závěrům.
            </p>
            <p className="mt-2 text-foreground/90">
              U rodinných domů se proto soustředíme na to podstatné: <strong>reálnou pořizovací cenu za m² vůči skutečně realizovaným prodejům z databází Českého statistického úřadu (ČSÚ)</strong>.
            </p>

            <h4 className="mt-5 text-sm font-semibold text-foreground">
              Tři srozumitelná cenová pásma:
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <span className="text-xs font-bold text-emerald-400">🟢 Levnější než průměr</span>
                <p className="mt-1 text-xs text-muted-foreground">Cena za m² je znatelně pod cenovou hladinou realizovaných prodejů v daném okrese a velikostním pásmu.</p>
              </div>
              <div className="rounded-lg border border-border bg-[var(--color-surface-2)] p-3">
                <span className="text-xs font-bold text-muted-foreground">⚪ V průměru</span>
                <p className="mt-1 text-xs text-muted-foreground">Cena za m² odpovídá běžnému standardu realizovaných nákupů (v toleranci ± 10 %).</p>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <span className="text-xs font-bold text-red-400">🔴 Dražší než průměr</span>
                <p className="mt-1 text-xs text-muted-foreground">Cena za m² převyšuje obvyklou cenovou hladinu pro danou velikost a lokalitu.</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              💡 <strong>Co vzít vždy v úvahu:</strong> Cena za m² u domu je silně ovlivněna velikostí pozemku, technickým stavem a vybavením. Velká zahrada nebo luxusní rekonstrukce přirozeně posouvá dům do vyšší cenové hladiny. Srovnání slouží pro rychlou orientaci; výměru pozemku vidíte na kartě inzerátu i v XLS exportu.
            </div>
          </div>
        </div>

        {/* SEKCIE 3: KOMPROMISY A TRANSPARENTNOST */}
        <div className="mt-12 space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-2xl font-bold text-foreground">
              3. Co metodika umí a kde dělá kompromisy
            </h2>
            <p className="text-xs text-muted-foreground">
              Hrajeme s otevřenými kartami — žádný algoritmus nenahradí osobní návštěvu nemovitosti.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" /> Co RealityScanner dělá skvěle
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Prohledá stovky nových inzerátů denně během vteřiny.</li>
                <li>• Odhalí skryté cenové pasti a anuity u družstevních bytů.</li>
                <li>• Okamžitě oddělí předražené nabídky od investičně zajímavých.</li>
                <li>• Hlídací pes Vás upozorní na podhodnocenou nabídku dříve než ostatní.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4" /> Kde jsou limity algoritmu
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>• Nevidí stav interiéru, výhled z okna ani hlučnost sousedů.</li>
                <li>• Neřeší specifika luxusních vil či historických památek.</li>
                <li>• Nezahrnuje individuální daňové odpisy a konkrétní hypotéku.</li>
                <li>• Slouží jako filtr pro výběr nabídek k prohlídce, ne jako znalecký posudek.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* SEKCIE 4: ČASTO KLADENÉ OTÁZKY (FAQ) */}
        <div className="mt-12 space-y-4">
          <div className="border-b border-border pb-2">
            <div className="flex items-center gap-2 text-primary">
              <HelpCircle className="h-5 w-5" />
              <h2 className="text-2xl font-bold text-foreground">Často kladené otázky (FAQ)</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Nejčastější dotazy investorů ohledně výpočtů, dat a fungování skeneru.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-[var(--color-surface)] p-4">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`} className="border-border">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div className="mt-10 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200/90 leading-relaxed">
          <strong>Upozornění:</strong> Všechny výpočty na RealityScanneru jsou orientační odhady určené k rychlému předvýběru (screeningu) inzerátů. Nejedná se o investiční doporučení, ocenění ani znalecký posudek. Před nákupem si nemovitost vždy ověřte fyzicky, prověřte právní stav (list vlastnictví, věcná břemena, anuitu u družstva) a propočtěte si vlastní model s reálnou hypotékou a daňovou situací.
        </div>
      </main>

      <Footer />
    </div>
  );
}
