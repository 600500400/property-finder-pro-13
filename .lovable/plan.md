# Srovnání s ČSÚ: nesoulad definice plochy — zjištění a plán opravy

Nic v textech jsem neměnil a hodnotu −9 % nikde nezveřejnil.

## 1. Jakou plochu ČSÚ používá

**Obytnou plochu rodinného domu.** Metodické vysvětlivky k publikaci „Ceny nemovitostí 2023–2025“ říkají přímo:

> „Jednotkovou cenou u rodinných domů je cena za 1 m² obytné plochy rodinného domu (v předchozích publikacích se jednalo o cenu za 1 m³ obestavěného prostoru).“

Zdroj: [Ceny nemovitostí](https://csu.gov.cz/produkty/ceny-nemovitosti), [Metodika statistiky cen nemovitostí](https://csu.gov.cz/metodika-statistiky-za-oblast-cen-nemovitosti). Plocha se doplňuje z registrů budov (RSO / RÚIAN), ne z inzerce. Obytná plocha = jen obytné místnosti; bez chodeb, technických místností, sklepa a garáže.

## 2. Co uvádějí naše čtyři zdroje

| Zdroj | Definice pole plochy | Medián | Průměr |
|---|---|---|---|
| Sreality | **Užitná plocha** — všechny místnosti, bez balkonu, terasy a garážového stání ([nápověda](https://o-seznam.cz/napoveda/sreality/pojmy/)) | 155 m² | 196 m² |
| Bezrealitky | žádná zveřejněná definice | 160,5 m² | 198 m² |
| Bazoš | žádné strukturované pole — plocha jen ve volném textu inzerenta | 155 m² | 227 m² |
| iDnes / RealityMix | žádná zveřejněná definice | 190 m² | 256 m² |

Naše hodnoty celkem: medián **160 m²**, průměr **205 m²**. ČSÚ: průměrná velikost RD v okresech má medián **84 m²** (77 okresů, rozsah 73–103 m²). Naše plocha je zhruba dvojnásobná — jiná definice, ne jiný trh.

## 3. Poměr nabídka : ČSÚ podle velikostního pásma

Bez Bazoše (viz bod 6):

| Naše plocha | Počet | Typická plocha | Medián poměru | Koeficient |
|---|---|---|---|---|
| < 100 m² | 133 | 74 m² | 1,142 | 0,876 |
| 100–150 m² | 167 | 120 m² | 1,266 | 0,790 |
| 150–250 m² | 251 | 186 m² | 0,942 | 1,062 |
| > 250 m² | 176 | 337 m² | 0,698 | 1,432 |

Poměr klesá monotónně s naší plochou. U domů blízkých velikosti ČSÚ jsou nabídky o **14–27 % NAD** realizovanými cenami — přesně jak se čeká. Celkové −9 % (resp. −4 % bez Bazoše) je artefakt složení vzorku, ne nález o trhu.

## 4. Co se udělá

### A. Srovnání a kalibrace po velikostních pásmech
Pásma < 100 / 100–150 / 150–250 / > 250 m². Kalibrace se počítá zvlášť pro každé pásmo a nabídka se porovnává s očekávanou hodnotou svého pásma — velký dům se už neporovnává s 84m² průměrem ČSÚ.

### B. Přepočet uváděné plochy na obytnou
Koeficient z tabulky výše se ukládá a přepočítává denně (ne natvrdo v kódu) a aplikuje se na všechny zdroje.

### 1. Žádné přesné procento u domů
Na kartě domu se místo čísla zobrazí jedna z pěti kategorií: **výrazně levnější / levnější / v průměru / dražší / výrazně dražší**. Konkrétní čísla (naše Kč/m², ČSÚ Kč/m², pásmo, koeficient, počet vzorků) zůstanou v bublině. **Byty se nemění** — jejich srovnání je stejná jednotka proti stejné jednotce, procento u nich zůstává.

### 2. Jednotky pojmenované všude
Naše hodnota vždy jako **„Kč/m² užitné plochy“**, ČSÚ jako **„Kč/m² obytné plochy (ČSÚ)“** — v bublině karty, v metodice i v hlavičkách sloupců exportu XLSX. Nikdy jako jedna jednotka.

### 3. Přiznaná cirkularita v metodice
Do metodiky doplním, že koeficient pro každé pásmo je odvozen z **našich vlastních nabídkových cen** ukotvených o ČSÚ. Opravuje tedy současně nesoulad definice plochy i skutečný vliv velikosti domu a nelze je od sebe oddělit. Výsledná úroveň je proto **odhad, ne měření**.

### 4. Bazoš: nízká důvěryhodnost plochy
Bazoš má poměr 0,678 proti ~0,96 u ostatních a plochu jen ve volném textu. Vyřadím ho z výpočtu kalibrace (čísla v tabulce výše už jsou bez něj) a u domů z Bazoše označím plochu v UI jako údaj s nízkou důvěryhodností.

### 5. Kontrola celého importu ČSÚ, ne jen smazání 4 řádků
Nalezené vadné řádky: kraj `plzensky` a `pardubicky`, `okres = 'nazev-okresu'`, `avg_size_m2 = 2023` — do číselného sloupce spadla hlavička s rokem. Projdu **celý import znovu** a vyhledám všechny řádky, kde do číselného sloupce prosákla hlavička nebo rok. Přidám kontrolu, která import **zastaví** místo uložení nesmyslu:
- `avg_size_m2` musí být 40–200
- ceny musí být 5 000–400 000 Kč/m²
- `okres` nesmí odpovídat textu hlavičky

### 6. Zaznamenání typu plochy
`floor-area.ts` bude ukládat, jaký popisek u čísla stál: `uzitna` / `obytna` / `zastavena` / `unlabelled`. Předběžný odhad podle výskytu slova v názvu a popisu (ne podle toho, co parser skutečně použil):

| Zdroj | užitná | obytná | zastavěná | bez popisku |
|---|---|---|---|---|
| Sreality | 123 | 83 | **28** | 1 043 |
| Bezrealitky | 89 | 70 | **43** | 130 |
| Bazoš | 101 | 41 | **20** | 108 |
| iDnes | 0 | 0 | 0 | 163 |

Zastavěná plocha se objevuje u 4–13 % nabídek — samostatné zkreslení, které dnes nikde neřešíme. Po zavedení pole se rozdělení přeměří přesně a nabídky se zastavěnou plochou se z kalibrace vyloučí.

### 7. Přeladění varování o ploše
Dnes by se zobrazilo u **681 z 985** domů se srovnáním (**69 %**) — čirý šum, protože se porovnává s průměrem jiné definice. Nově se bude počítat odchylka od typické velikosti **daného pásma** (74 / 120 / 186 / 337 m²) a práh se naladí na cílových **5–10 %** nabídek; skutečnou míru spuštění po naladění změřím a nahlásím.

Texty v metodice a v bublinách upravím teprve po zavedení A + B, a to na naměřenou přirážku u srovnatelných domů, nikdy na −9 %.

## Technické detaily

- `src/lib/listings/csu-benchmark.ts`: pásmo plochy, aplikace koeficientu, kategorie místo procenta pro domy, práh varování vůči typické velikosti pásma, příznak nízké důvěryhodnosti pro Bazoš.
- `src/routes/api/public/cron/csu-calibration.ts`: kalibrace po pásmech, vyloučení Bazoše a nabídek se zastavěnou plochou.
- Migrace: `csu_house_calibration` dostane řádek na pásmo (`band`, `median_ratio`, `factor`, `typical_area_m2`, `sample_count`) místo jediného singletonu; zachovám i stávající řádek, dokud kód nepřejde.
- `src/lib/scanner/floor-area.ts`: nový návratový typ `{ value, areaType }`, nová nullable kolona `area_type` v `listings`; validace importu ČSÚ jako samostatný skript s hard failem.
- `src/components/ListingCard.tsx`: kategorie u domů, procento jen u bytů, popis jednotek v bublině.
- Export XLSX: hlavičky „Cena Kč/m² užitné plochy“ a „ČSÚ Kč/m² obytné plochy“.
- `src/routes/metodika.tsx`: definice ČSÚ s citací, rozdíl jednotek, přiznaná cirkularita, zpoždění dat.
- Testy: monotónní gradient poměru po pásmech, koeficienty pásem, odmítnutí vadného importu (velikost 2023, hlavičkový okres, cena mimo rozsah), rozpoznání typu plochy, míra spuštění varování na reálném vzorku, byty si drží procento.
