# Srovnání s ČSÚ: nesoulad definice plochy — zjištění a návrh

Nic v textech jsem neměnil a hodnotu −9 % nikde nezveřejnil. Níže jsou zjištění a návrh, jak obě strany srovnat.

## 1. Jakou plochu ČSÚ používá

**Obytnou plochu rodinného domu.** V metodických vysvětlivkách k publikaci „Ceny nemovitostí 2023–2025“ stojí přímo:

> „Jednotkovou cenou u rodinných domů je cena za 1 m² obytné plochy rodinného domu (v předchozích publikacích se jednalo o cenu za 1 m³ obestavěného prostoru).“

Zdroj: metodické vysvětlivky ke [Ceny nemovitostí](https://csu.gov.cz/produkty/ceny-nemovitosti) a [Metodika statistiky cen nemovitostí](https://csu.gov.cz/metodika-statistiky-za-oblast-cen-nemovitosti). Plocha se doplňuje z registrů budov (RSO / RÚIAN), ne z inzerce. Starší publikace (do ~2015) stavěly na daňových přiznáních a cenu domů uváděly za m³ obestavěného prostoru — proto je řada nesrovnatelná se starými čísly.

Obytná plocha = jen obytné místnosti. Nepatří do ní chodby, technické místnosti, sklep, garáž, ani (typicky) podkroví bez obytného využití.

## 2. Co uvádějí naše čtyři zdroje

| Zdroj | Definice pole plochy | Medián plochy domu | Průměr |
|---|---|---|---|
| Sreality | **Užitná plocha** — součet ploch všech místností, bez balkonu, terasy a garážového stání; sklep jen jako samostatná místnost ([nápověda](https://o-seznam.cz/napoveda/sreality/pojmy/)) | 155 m² | 196 m² |
| Bezrealitky | žádná zveřejněná definice pole | 160,5 m² | 198 m² |
| Bazoš | vůbec žádné strukturované pole — plocha je jen ve volném textu inzerenta | 155 m² | 227 m² |
| iDnes / RealityMix | žádná zveřejněná definice pole | 190 m² | 256 m² |

Naše hodnoty: **medián 160 m², průměr 205 m².** ČSÚ: průměrná velikost RD v okresech má medián **84 m²** (77 okresů v rozsahu 73–103 m²). Naše plocha je tedy zhruba **dvojnásobná** — a to je jiná definice, ne jiný trh.

Náš vlastní parser navíc bere „užitná“, „obytná“ i „zastavěná“ plocha jako jedno a totéž, takže i uvnitř našich dat je definice nekonzistentní.

## 3. Poměr nabídka : ČSÚ podle velikostního pásma

| Naše plocha | Počet | Medián plochy | Medián poměru nabídka/ČSÚ |
|---|---|---|---|
| < 100 m² | 167 | 75 m² | **1,125** |
| 100–150 m² | 247 | 120 m² | **1,145** |
| 150–250 m² | 337 | 186 m² | **0,893** |
| > 250 m² | 234 | 345 m² | **0,601** |

Poměr klesá monotónně s naší plochou. U domů blízkých velikosti ČSÚ (75–120 m²) jsou nabídky o **12–15 % NAD** realizovanými cenami — přesně jak se čeká. Klesání pod 1 nastává až tam, kde je naše plocha 2–4× větší než u ČSÚ. **To potvrzuje nesoulad definice, ne nález o trhu.** Celkové −9 % je artefakt složení vzorku.

Rozdíl je i mezi portály: Sreality 0,964, Bezrealitky 0,979, iDnes 0,916, **Bazoš 0,678** — Bazoš je nejhorší, což odpovídá tomu, že u něj je plocha jen volný text.

## 4. Varování o odchylce plochy

Dnes by se zobrazilo u **681 z 985** domů se srovnáním, tedy u **69 %**. Jako varování je to bezcenné — porovnává se totiž s průměrem jiné definice.

## 5. Návrh, jak obě strany srovnat

Doporučuji kombinaci A + B; C je záložní varianta.

**A. Srovnávat jen v podobném velikostním pásmu (jádro opravy).**
Kalibrace a srovnání se počítají zvlášť pro pásma plochy < 100 / 100–150 / 150–250 / > 250 m². Nabídka se porovnává s očekávanou hodnotou pro své pásmo, takže velký dům se už neporovnává s 84m² průměrem ČSÚ.

**B. Odhad obytné plochy z uváděné plochy.**
Z dat odvodit přepočtový koeficient (užitná → obytná) tak, aby medián poměru u domů blízkých velikosti ČSÚ vycházel na společnou úroveň, a použít ho u všech zdrojů. Koeficient bude uložený a přepočítávaný, ne natvrdo v kódu.

**C. Srovnání celkové ceny místo Kč/m².**
U domů zobrazit „typická realizovaná cena domu v této oblasti“ (ČSÚ Kč/m² × průměrná obytná plocha okresu) proti celkové ceně nabídky. Odstraní to jednotky úplně, ale ztratí se srovnání podle velikosti.

**Varování o ploše** se převáže na pásmo z bodu A (odchylka od typické velikosti v daném pásmu, ne od 84 m²), s prahem nastaveným tak, aby se zobrazovalo u řádově 5–10 % nabídek, ne u 69 %.

**Texty v metodice a v bublinách** upravím teprve po zavedení A/B, a to na skutečně naměřenou přirážku u srovnatelných domů (dnes 12–15 %), nikoli na −9 %.

## Technické detaily

- V `csu_house_prices_okres` jsou 4 nepoužitelné řádky z importu (kraj `plzensky` a `pardubicky`, `okres = 'nazev-okresu'`, `avg_size_m2 = 2023`, ceny NULL). Nejsou nebezpečné (nemají cenu, takže nikdy nevyhrají), ale patří odstranit.
- Změny by se soustředily do `src/lib/listings/csu-benchmark.ts` (pásmo plochy, přepočet, práh varování), `src/routes/api/public/cron/csu-calibration.ts` (kalibrace po pásmech místo jednoho čísla) a `csu_house_calibration` (řádek na pásmo místo singletonu).
- `src/lib/scanner/floor-area.ts` dnes sjednocuje „užitná / obytná / zastavěná“ — stálo by za to zaznamenávat, který typ plochy byl v textu nalezen, aby se dala měřit kvalita podle zdroje.
- Testy: monotónní gradient poměru po pásmech, koeficient přepočtu, míra spuštění varování o ploše na reálném vzorku.
