# ČSÚ ceny domů jako hlavní srovnání

## Co udělám

### 1. Import obou tabulek ČSÚ

**Okresní tabulka (list „1-4")** — od řádku 8:
- Kraj se doplňuje dolů (v souboru je jen u prvního řádku skupiny), Praha je jeden řádek bez okresu.
- Uložím: průměrnou velikost domu v m², kupní cenu za období 2023–2025, počet převodů, ceny za roky 2023 / 2024 / 2025 (jen za celý okres) a čtyři ceny podle velikosti obce (do 1999 / 2000–9999 / 10000–49999 / 50000+).
- Řádky „Celkem <kraj>" a „Celkem ČR" se importují zvlášť jako souhrny, ne jako okresy.

**Krajská tabulka (list „1-3")** — použije se jako záloha, když okres nelze určit. Pokud už je obec a její pásmo známé, použije se přímo krajská hodnota roku 2025 pro toto pásmo; teprve bez pásma se použije krajský souhrn roku 2025.

**Čištění hodnot:** „x" znamená utajeno → chybějící hodnota, nikdy nula. Odstraním pevné mezery a poznámky typu „ 1)" a zbytek načtu jako číslo.

### 2. Přepočet na dnešní úroveň (okresní pásma)

Pásma existují jen jako průměr 2023–2025, proto je zvednu trendem celého okresu:

```text
srovnávací cena = cena_pásma_2023_2025 × (cena_okresu_2025 / cena_okresu_2023_2025)
```

Uložím tři čísla: původní průměr, přepočtenou hodnotu a použitý koeficient. Když u okresu chybí rok 2025, koeficient je 1 a hodnota zůstane nepřepočtená. Stejný přepočet se použije pro Prahu: průměr 112 593 Kč/m² se přepočte trendem na úroveň roku 2025 (119 239 Kč/m²), místo použití nepřepočteného průměru.

### 3. Přiřazení nabídky ke správné hodnotě

Postup v tomto pořadí:
1. okres + velikostní pásmo obce (nejpřesnější),
2. celý okres — hodnota roku 2025 — když pásmo nelze určit **nebo když je hodnota správně určeného pásma utajená (`x`) či chybí**; srovnání se výslovně označí jako okresní,
3. kraj + pásmo, když okres nelze určit, ale obec a její pásmo ano,
4. celý kraj (rok 2025), když nelze určit okres ani pásmo,
5. Praha má jediný řádek a použije se po výše popsaném přepočtu na rok 2025.

Utajená hodnota se nikdy nepřevede na nulu. Když existuje okresní souhrn roku 2025, nabídka nezůstane bez srovnání jen kvůli utajenému pásmu.

### 3b. Import obcí a určení velikostního pásma

Nahraný soubor obsahuje 6 258 obcí s počtem obyvatel k 1. 1. 2025. Kraj je uveden jako hlavička sekce a doplní se dolů na všechny obce pod ní; Praha je zároveň hlavička i jediná obec. Úvodní popisné řádky i závěrečné řádky s časem generování se přeskočí.

Soubor neobsahuje okres, proto:
- Obce se párují na kombinaci **název obce + kraj**, vždy jen přesnou shodou po normalizaci (malá písmena, bez diakritiky, sjednocené mezery a spojovníky). Žádná shoda podle začátku slova ani přibližná — „Mikulov" se nikdy nespáruje s „Mikulovice".
- Když název obce v daném kraji odpovídá více řádkům (165 takových případů, např. Bukovany, Hradištko, Dlouhá Lhota ve Středočeském kraji), pásmo se **neuhaduje**. Nabídka se srovná s celookresním údajem a označí se poznámkou, že obec nelze jednoznačně určit.
- Městské části se sčítají pod matku: „Praha – Záběhlice" → Praha, „Brno-Žabovřesky" → Brno, stejně pro Ostravu, Plzeň, Ústí nad Labem, Liberec, Olomouc a Pardubice.

Podle počtu obyvatel se nabídce přiřadí pásmo do 1999 / 2000–9999 / 10000–49999 / 50000 a více.

### 4. Zobrazení

- **Domy:** hlavní srovnání je ČSÚ. Srovnání z inzerátů zůstane jako druhá, tlumená řádka a jen když je vzorek alespoň 10.
- **Byty:** nic se nemění, primární zůstává medián z inzerátů, ČSÚ se nepoužije.
- **Nižší důvěryhodnost:** když se plocha domu liší od průměrné velikosti domu v daném okrese o více než 50 %, srovnání se označí varovnou ikonou a tlumeným stylem (stejně jako dnes u slabých vzorků).
- **Tooltip u ČSÚ hodnoty:** výrazně upozorní, že ČSÚ uvádí skutečně realizované kupní ceny, zatímco inzerát uvádí nabídkovou cenu, která bývá systematicky vyšší. Kladná odchylka proto sama o sobě neznamená, že je dům předražený. Zobrazí také aktuálně vypočtenou typickou přirážku nabídkových cen vůči ČSÚ.

### 5. Metodika

Do stránky metodiky doplním výraznou část o srovnání cen domů:
- ČSÚ uvádí ceny, za které se domy **skutečně prodaly**, zatímco nabídky ukazují **nabídkové ceny**, které bývají systematicky vyšší. Kladná odchylka od ČSÚ proto sama o sobě neznamená předražení.
- Dynamicky zobrazím medián poměru `nabídková Kč/m² / ČSÚ Kč/m²` přes všechny aktivní domy, které mají obě hodnoty, převedený na větu typu „Typická nabídka je o 28 % nad realizovanou cenou.“ Hodnota nebude natvrdo a bude se pravidelně přepočítávat.
- Ceny pocházejí z období 2023–2025 a mají přibližně roční zpoždění. Okresní velikostní pásmo je průměr za toto období přepočtený na úroveň roku 2025 trendem celého okresu; u krajské zálohy se používá přímo rok 2025.
- ČSÚ data pokrývají starší rodinné domy, nikoli novostavby. Uvnitř jednoho pásma se dále nerozlišuje velikost domu; průměrný dům ČSÚ má přibližně 80–95 m².
- Cena za m² podlahové plochy nezohledňuje velikost ani hodnotu pozemku.
- Přepočet ověřím vlastním automatickým testem proti krajské tabulce: pro každou dostupnou kombinaci kraj × pásmo porovnám `pásmo_průměr_2023_2025 × (kraj_2025 / kraj_průměr_2023_2025)` se skutečnou hodnotou pásma za rok 2025. Test vypočte průměrnou absolutní, mediánovou a maximální procentní chybu a selže, pokud průměrná absolutní chyba překročí 4 %. Do metodiky a reportu uvedu pouze hodnoty skutečně vypočtené tímto testem, nikoli předem dodaná čísla.

## Technické detaily

- Migrace: `csu_house_prices_okres` (kraj, okres, avg_size_m2, price_2023_2025, transfers, price_2023/2024/2025, band, band_price_raw, band_price_uplifted, uplift_factor, level = okres/kraj_total/cr_total) a `csu_house_prices_kraj` (kraj, band, price_2023/2024/2025, price_avg, transfers, avg_size_m2). Jde o veřejná statistická data: tabulky dostanou `SELECT` pro `anon` i `authenticated`, `ALL` pro `service_role`, zapnuté RLS a úzké veřejné read-only policy; žádné veřejné zápisy.
- Řádky vložím dávkově přes datové nástroje, ne v migraci.
- Nový modul `src/lib/listings/csu-benchmark.ts`: resolver okres/pásmo (staví na `okresFromLocality` z `src/lib/scanner/okresy.ts`), výpočet odchylky ceny a příznaku nízké důvěryhodnosti; okresní/krajská data se načtou v `query.functions.ts` a přiloží k nabídkám jako `csu_compare`.
- `ListingCard.tsx`: u domů `csu_compare` jako primární metrika, `price_compare` (n ≥ 10) sekundárně; existující tlumený styl a `AlertTriangle` se použijí i pro odchylku plochy > 50 %.
- Testy: parsování „x" a „78 541  1)", forward-fill kraje, přepočtový koeficient včetně Prahy, fallback z utajeného pásma na okresní rok 2025, zachování pásma při krajském fallbacku, výběr úrovně okres → kraj, hranice odchylky 50 % a validační test všech kraj × pásmo kombinací s limitem průměrné chyby 4 %.
- Tabulka `obce_population` (kraj, name, name_norm, population, is_ambiguous_in_kraj) + index na `(kraj, name_norm)`; mapa městských částí na matku je v kódu, ne v datech.
- Kalibrace se bude ukládat s časem posledního výpočtu a obnovovat jednou denně z aktivních domů s platnou nabídkovou Kč/m² a přiřazeným ČSÚ benchmarkem. Stejná hodnota se načte do metodiky i tooltipů.
- Report po importu: počet kombinací okres × pásmo, kolik domů získá srovnání ČSÚ místo „nedostatek dat", 5 příkladů; kolik nabídek má pásmo, kolik spadlo na okres kvůli nejednoznačnému názvu, kolik se nespárovalo vůbec, 20 nejčastějších nespárovaných lokalit; a vypočtený medián přirážky nabídkových cen vůči realizovaným cenám ČSÚ.
- Ověření v živém náhledu zahrne odhlášenou relaci: u domů musí být ČSÚ srovnání viditelné i anonymnímu návštěvníkovi.
