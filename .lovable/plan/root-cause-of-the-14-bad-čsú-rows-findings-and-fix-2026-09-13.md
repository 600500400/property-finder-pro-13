# Root cause of the 14 bad ČSÚ rows — findings and fix

## What actually happened

The ČSÚ file marks low-sample values with a footnote: the cell literally contains
`    78 541  1)` instead of a number. The import stripped every non-digit character
from such cells, so the footnote marker `1)` contributed its digit `1` to the number:

```text
source cell:  "36 732  1)"   ->  digits only: 367321   (36 732 x 10 + 1)
Písek 10 000-49 999:  "63 986  1)" -> 639861 -> after size uplift 617 806 Kč/m²
```

So this is not a bad ČSÚ file and not random error — it is one parser bug, and it hits
exactly the cells that carry the footnote. That is why it looked systematic: 14 of the
band cells in the file are footnote-marked.

Every affected value is exactly `true value x 10 + 1`, i.e. always an order of magnitude
too large. That is important for the "plausible-looking error" concern: this bug cannot
produce 90 000 instead of 45 000 — it can only produce 450 001.

## Full verification against the source file

I re-parsed `0140162602.xlsx` (footnotes handled correctly) and compared **every stored
cell** for all okres and kraj rows: size, purchase price, number of transfers, 2023,
2024, 2025 and all four municipality-size band prices.

| Check | Result |
|---|---|
| Okres cells compared | 2 156 |
| Cells differing from the source | 14 — all footnote cells, all `x10+1` |
| Other differences (any column) | 0 |
| Kraj-total cells compared | 84 |
| Kraj-total differences | 0 |

So there are no silent, plausible-looking wrong values in the okres reference data —
the only corrupted cells are the 14 already caught.

## A second, separate finding

The okres table also contains 68 empty ghost rows: kraj `plzensky` and `pardubicky`
with no okres name (and 8 rows whose okres is literally the header text "Název okresu").
These come from the page-break header and blank lines repeated in the middle of the
sheet. All their values are NULL, so they never influence a benchmark, but they pollute
row counts and sample counts.

## Fix

1. **Correct the 14 values in place** with a migration: set `band_price_raw` to the true
   value and recompute `band_price_uplifted` with the existing band factor. No more
   discarding — Písek 2 000-9 999 becomes 36 732 Kč/m², 10 000-49 999 becomes 63 986,
   instead of falling back to the okres average.
2. **Delete the 68 ghost rows** (level `okres` with NULL or header-text okres).
3. **Fix the parser** so a re-import cannot reintroduce this: strip a trailing footnote
   marker (`1)`, `2)`) before parsing, treat `x`, `i.d.`, `-` as no data, and reject any
   band price outside a sane range (10 000-300 000 Kč/m²) as an import error rather than
   silently storing it.
4. **Mark low-sample values as such.** The footnote means "small number of observations",
   which is exactly the signal our comparison should weaken. Store a `low_sample` flag on
   those band rows and have the house comparison treat them like a low sample count
   (muted styling, warning), instead of trusting them as a full benchmark.
5. **Re-run the same full-file diff** as a check after the migration, and also run it for
   the municipality-size table from `0140162601.xlsx`, so both reference tables are
   verified cell by cell.
6. **Add a test** covering the footnote/`x`/`i.d.` cell forms in the parser.

## Technical notes

- Bad cells: Beroun, Kutná Hora, Rakovník, Český Krumlov, Písek (x2), Strakonice (x2),
  Klatovy (x2), Chomutov, Jičín, Brno-venkov, Ostrava-město.
- The current plausibility guard (drop `> 200 000 Kč/m²`, fall back to the okres price)
  stays as a last-resort net, but after the fix it should never trigger.
- Migration files under `supabase/migrations`; parser and band logic in
  `src/lib/listings/csu-benchmark.ts` plus the ČSÚ import script.
