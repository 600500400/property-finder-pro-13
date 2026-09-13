// Single export path for the result grid: one .xlsx of the current filtered set.
// Numbers stay numeric; units live in the cell number format.
import type { Listing } from "@/lib/scanner/types";
import { OKRES_BY_SLUG, okresFromLocality } from "@/lib/scanner/okresy";

export const MAX_EXPORT_ROWS = 5000;

const KRAJ_LABEL: Record<string, string> = {
  praha: "Hlavní město Praha",
  stredocesky: "Středočeský",
  jihocesky: "Jihočeský",
  jihomoravsky: "Jihomoravský",
  karlovarsky: "Karlovarský",
  kralovehradecky: "Královéhradecký",
  liberecky: "Liberecký",
  moravskoslezsky: "Moravskoslezský",
  olomoucky: "Olomoucký",
  pardubicky: "Pardubický",
  plzensky: "Plzeňský",
  ustecky: "Ústecký",
  vysocina: "Vysočina",
  zlinsky: "Zlínský",
};

const PROPERTY_LABEL: Record<string, string> = {
  byty: "byt",
  domy: "dům",
  komercni: "komerční",
  pozemky: "pozemek",
  ostatni: "ostatní",
};

type CellValue = string | number | Date | null;

interface Column {
  header: string;
  width: number;
  numFmt?: string;
  link?: boolean;
  value: (l: Listing) => CellValue;
}

/** Percentage-point difference vs. the benchmark actually used, as a fraction for Excel. */
function benchmarkDiff(l: Listing): number | null {
  const csu = l.csu_compare;
  if (csu && csu.expected_per_m2 > 0) {
    return (csu.own_per_m2 - csu.expected_per_m2) / csu.expected_per_m2;
  }
  const pc = l.price_compare;
  if (pc) return pc.diff_pct / 100;
  return null;
}

function benchmarkSource(l: Listing): string | null {
  if (l.csu_compare) return "ČSÚ";
  if (l.price_compare) return "medián nabídek";
  return null;
}

function benchmarkValue(l: Listing): number | null {
  if (l.csu_compare) return l.csu_compare.expected_per_m2 || null;
  if (l.price_compare) return l.price_compare.median_per_m2 || null;
  return null;
}

function benchmarkLevel(l: Listing): string | null {
  if (l.csu_compare) return l.csu_compare.scope_label;
  const pc = l.price_compare;
  if (!pc) return null;
  return pc.scope === "okres" ? "okres" : pc.scope === "kraj" ? "kraj" : "ČR";
}

function benchmarkSamples(l: Listing): number | null {
  if (l.csu_compare) return l.csu_compare.band_sample_count ?? null;
  return l.price_compare?.samples ?? null;
}

function benchmarkVerdict(l: Listing): string | null {
  if (l.csu_compare) return l.csu_compare.verdict_label;
  const pc = l.price_compare;
  if (!pc) return null;
  return pc.band === "below" ? "pod mediánem" : pc.band === "above" ? "nad mediánem" : "v mediánu";
}

function pricePerM2(l: Listing): number | null {
  if (!l.price || !l.area_m2) return null;
  return Math.round(l.price / l.area_m2);
}

function okresLabel(l: Listing): string | null {
  const slug = okresFromLocality(l.locality);
  if (!slug) return null;
  return OKRES_BY_SLUG[slug]?.label ?? slug;
}

function flagsText(l: Listing): string | null {
  const labels = (l.flags ?? []).map((f) => f.label).filter(Boolean);
  return labels.length ? labels.join("; ") : null;
}

function publishedDate(l: Listing): Date | null {
  if (!l.published_at) return null;
  const d = new Date(l.published_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

const BASE_COLUMNS: Column[] = [
  { header: "Zdroj", width: 14, value: (l) => l.source || null },
  { header: "Typ nemovitosti", width: 15, value: (l) => PROPERTY_LABEL[l.property_type ?? ""] ?? null },
  { header: "Název", width: 46, value: (l) => l.name || null },
  { header: "Obec", width: 22, value: (l) => l.locality || null },
  { header: "Okres", width: 20, value: okresLabel },
  { header: "Kraj", width: 22, value: (l) => (l.kraj ? KRAJ_LABEL[l.kraj] ?? l.kraj : null) },
  { header: "Cena", width: 16, numFmt: '#,##0 "Kč"', value: (l) => l.price || null },
  { header: "Plocha", width: 11, numFmt: '#,##0 "m²"', value: (l) => l.area_m2 ?? null },
  { header: "Kč/m²", width: 12, numFmt: "#,##0", value: pricePerM2 },
  { header: "Plocha pozemku", width: 15, numFmt: '#,##0 "m²"', value: (l) => l.land_area_m2 ?? null },
];

const YIELD_COLUMNS: Column[] = [
  { header: "Hrubý výnos", width: 13, numFmt: '0.0 "%"', value: (l) => l.invest?.gross_yield ?? null },
  { header: "Čistý výnos", width: 13, numFmt: '0.0 "%"', value: (l) => l.invest?.net_yield ?? null },
  { header: "Návratnost (let)", width: 15, numFmt: "0.0", value: (l) => l.invest?.payback_years ?? null },
  { header: "Hvězdičky", width: 11, numFmt: "0", value: (l) => l.invest?.stars ?? null },
  { header: "Hodnocení", width: 20, value: (l) => l.invest?.verdict ?? null },
];

const TAIL_COLUMNS: Column[] = [
  { header: "Odchylka vs. benchmark", width: 21, numFmt: "+0.0 %;−0.0 %;0.0 %", value: benchmarkDiff },
  { header: "Hodnocení vs. benchmark", width: 21, value: benchmarkVerdict },
  { header: "Zdroj srovnání", width: 17, value: benchmarkSource },
  { header: "Použitý benchmark (Kč/m²)", width: 22, numFmt: "#,##0", value: benchmarkValue },
  { header: "Úroveň srovnání", width: 22, value: benchmarkLevel },
  { header: "Počet vzorků / převodů", width: 20, numFmt: "#,##0", value: benchmarkSamples },
  { header: "Datum inzerátu", width: 15, numFmt: "dd.mm.yyyy", value: publishedDate },
  { header: "Vlajky", width: 40, value: flagsText },
  { header: "Odkaz", width: 52, link: true, value: (l) => l.url || null },
];

/** Yield metrics are hidden for houses, so a houses-only set drops those columns entirely. */
export function columnsFor(listings: Listing[]): Column[] {
  const hasNonHouse = listings.some((l) => l.property_type !== "domy");
  return hasNonHouse ? [...BASE_COLUMNS, ...YIELD_COLUMNS, ...TAIL_COLUMNS] : [...BASE_COLUMNS, ...TAIL_COLUMNS];
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  rows: number;
  truncated: boolean;
  totalRows: number;
}

export async function buildListingsXlsx(all: Listing[]): Promise<ExportResult> {
  const { default: ExcelJS } = await import("exceljs");
  const listings = all.slice(0, MAX_EXPORT_ROWS);
  const columns = columnsFor(listings);

  const wb = new ExcelJS.Workbook();
  wb.creator = "RealityScanner";
  wb.created = new Date();
  const ws = wb.addWorksheet("Inzeráty", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };

  for (const l of listings) {
    const row = ws.addRow(columns.map((c) => c.value(l) ?? null));
    columns.forEach((c, i) => {
      if (!c.link) return;
      const cell = row.getCell(i + 1);
      const url = typeof cell.value === "string" ? cell.value : null;
      if (!url) return;
      cell.value = { text: url, hyperlink: url };
      cell.font = { color: { argb: "FF1155CC" }, underline: true };
    });
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `reality_scanner_${new Date().toISOString().slice(0, 10)}.xlsx`,
    rows: listings.length,
    truncated: all.length > listings.length,
    totalRows: all.length,
  };
}
