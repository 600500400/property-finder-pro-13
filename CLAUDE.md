# CLAUDE.md — RealityScanner

## What this is
RealityScanner (https://www.realityscanner.cz) is a live Czech SaaS for private real-estate investors.
It aggregates listings from Czech portals, computes rental yield and a price rating.
Current goal: turn the first prospects into paying customers. Customer experience comes first.

Owner: Kamil. Communicate with him in Czech. Code, commit messages and comments in English.

## Stack
- Lovable (TanStack Start), Supabase, Drizzle, Resend, Firecrawl, Stripe (test mode until go-live)
- Package manager: bun (`bun.lock`). Tests live in `tests/`.
- Active scraper sources: `src/lib/scanner/active-sources.ts`
- Repo: `600500400/property-finder-pro-13`, single branch `main`

## Git workflow — Lovable two-way sync (read first)
- This repo is two-way synced with Lovable on the default branch (`main`). Whatever lands on `main` appears in Lovable.
- Always `git pull` before starting — Lovable may have pushed new commits.
- Never commit directly to `main`. Work on `claude/<short-topic>`, keep one topic per branch, open a PR.
- PR description in Czech: what changes for the customer, how to verify (checklist), risks.
- Merge only after Kamil explicitly approves.
- Do not transfer or move the repository and do not change its owner — it breaks the Lovable sync.
- Use bun. Before pushing, run `bun install` and the available scripts from `package.json` (typecheck, lint, build, tests) and report the results in the PR.
- Do not edit or delete `.lovable/` or `.env` — both are managed by Lovable. Never add secrets to `.env` or any other file; secrets live in Supabase / Lovable settings.
- Mark in the PR title/body:
  - `DB CHANGE` — any change in `drizzle/`, `drizzle.config.ts`, `supabase/`, schema, RLS or migrations (never do this unless the task asks)
  - `GO-LIVE IMPACT` — anything touching payments, personal data, legal texts or scraping

## Do not change without explicit approval
- Yield formulas and default assumptions
- Price-rating logic and thresholds
- Stripe, auth, RLS, database schema
- Existing routes/pages (don't delete or rename)

## Product principles
- Every screen answers one question: "Is this property worth it, and why?"
- Truthful: every number shows its source and data date; show sample size; label `málo dat` when the sample is small (default n < 5 unless the code defines otherwise). Never silently fill missing data. The tool filters offers; it does not value properties.
- Simple: one headline number per card, details collapsible, no unexplained jargon.
- Deep analysis (mortgage, cashflow, scenarios) belongs in the XLS export, not the UI.

## UI copy
- Czech, formal "Vy", short sentences, no developer jargon.
- Format numbers with `Intl.NumberFormat('cs-CZ')`: `4 500 000 Kč`, `4,0 %`. Percentages with 1 decimal.
- Never promise "přesné ocenění", "garantovaný výnos" or similar.

## Yield calculator
- Max 4 visible inputs: purchase price, monthly rent, owner's monthly costs, vacancy. All prefilled, editable; estimates labelled `odhad` with their source.
- Gross yield = rent × 12 ÷ price
- Net yield = (rent × 12 × (1 − vacancy) − owner costs × 12) ÷ price
- Owner costs = what is not recharged to the tenant (repair fund, insurance, property tax, management).
- Always render the calculation in words with the actual numbers, e.g.
  `15 000 Kč × 12 = 180 000 Kč ročně ÷ 4 500 000 Kč = 4,0 %`
- If the existing code computes differently, stop and report it instead of "fixing" it.
- UI formulas must match the Metodika page.

## Price rating
- Houses: compared with ČSÚ realized prices (2025) by district, municipality size and house size band (<100, 100–150, 150–250, >250 m²). Output is a 5-level verbal scale (`výrazně levnější` … `výrazně dražší`), never a percentage — ČSÚ uses living area, portals use usable area.
- Flats: percentage vs comparable listings of the same type and size nearby.

## XLS export
- Real `.xlsx` with live formulas (not pasted values) — e.g. exceljs or SheetJS.
- Listing data, link, portal, data download date, all calculator inputs as editable cells, results as formulas.
- Sheets: data, `Předpoklady` (what is an estimate and where it comes from), `Metodika` (short + link).
- Czech column labels. Acceptance test: change rent or price in Excel → yield recalculates.

## Legal / go-live state
- Footer shows `Ceník · Metodika`. `Obchodní podmínky` and `Soukromí` are temporarily hidden from the footer; their routes stay. They must be completed (company ID, address, contact, GDPR) and restored before Stripe goes live.
