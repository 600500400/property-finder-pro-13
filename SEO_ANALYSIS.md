markdown
# SEO Analýza & Audit — RealityScanner.cz

## 1. Úvod & Cíle SEO
RealityScanner.cz je vyhledávač a analyzátor investičních nemovitostí. Hlavními cíli SEO strategie jsou:
- Organická akvizice investorů a zájemců o koupi nemovitostí.
- Konverze do bezplatné registrace, odběru hlídacích psů a nákupu tarifu Premium.
- Budování autority v oblasti investičních výpočtů (výnos, LTV, ROI).

## 2. Technický Audit & Meta Tagy po podstránkách

### A. Hlavní stránka (`src/routes/index.tsx`)
* **Stav:** Klíčová vstupní stránka s interaktivním filtrem.
* **Doporučení:**
  - Implementovat rich snippets pomocí Schema.org `WebSite` a `SoftwareApplication` (Real Estate Investment Tool).
  - Doplnit přesné meta tagy a canonical link `https://www.realityscanner.cz` (bez lomítka, s www).
  - Přidat `og:image` s rozměrem 1200x630 px.

### B. Stránka Ceník (`src/routes/cenik.tsx`)
* **Stav:** Hotovo v nedávné aktualizaci (meta tagy a canonical linky nasazeny).
* **Doporučení:**
  - Implementovat strukturovaná data `FAQPage` (JSON-LD) pro často kladené otázky k tarifům a předplatnému, což zvýší CTR ve výsledcích vyhledávání (SERP).

### C. Metodika výpočtů (`src/routes/metodika.tsx`)
* **Stav:** Vynikající potenciál pro long-tail klíčová slova (např. 'jak spočítat čistý výnos z pronájmu', 'výpočet ROI u nemovitostí').
* **Doporučení:**
  - Doplnit strukturovaná data typu `Article` nebo `FAQPage` pro vysvětlené pojmy.
  - Ujistit se, že všechny vzorce a pojmy mají podnadpisy H2/H3 s klíčovými slovy.

### D. Právní podstránky (`/obchodni-podminky`, `/ochrana-osobnich-udaju`)
* **Doporučení:** Použít meta tag `{ name: "robots", content: "noindex, follow" }`, aby tyto čistě právní texty neředily SEO sílu webu (link equity), ale vyhledávač mohl procházet odkazy uvnitř nich.

## 3. Globální SEO Pravidla & Standardy
- **Canonical URLs:** Vždy používat formát `https://www.realityscanner.cz/cesta` (s `www`, bez koncového lomítka).
- **OpenGraph Tagy:** Striktně rozlišovat `{ property: "og:title" }` a `{ name: "twitter:title" }` (nepoužívat name pro og:).
- **Sémantika:** Maximálně jeden tag `<h1>` na stránku, správná hierarchie H2 a H3, doplňování popisků `alt` u všech obrázků.

## 4. Akční Plán Implementace (Next Steps)
1. **Krok 1:** Doplnění Schema.org JSON-LD na hlavní stránku (vytvořit komponentu pro vložení strukturovaná data do `<head>`).
2. **Krok 2:** Vytvoření dynamické sitemapy `/sitemap.xml` a statického `robots.txt` v TanStack Start (využít API routy v `src/routes/api/sitemap.ts`).
3. **Krok 3:** Nastavení `noindex` pro právní a zabezpečené routy v `_authenticated/*`.
