import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { vi } from "vitest";
import type { Listing } from "@/lib/scanner/types";
import { sortListings } from "@/lib/scanner/sort";
import { columnsFor } from "@/lib/export/xlsx-export";
vi.mock("@/components/AIAnalysisDialog", () => ({ AIAnalysisButton: () => null }));
vi.mock("@/components/SaveBookmarkButton", () => ({ SaveBookmarkButton: () => null }));
import { ListingCard } from "@/components/ListingCard";
const listing = {
  name: "Testovací byt",
  url: "https://example.com/byt",
  source: "Sreality",
  property_type: "byty",
  price: 4500000,
  price_text: "4 500 000 Kč",
  invest: {
    gross_yield: 4,
    net_yield: 99,
    monthly_rent: 15000,
    annual_rent: 180000,
    payback_years: 25,
    stars: 3,
    verdict: "Průměrný výnos",
    rent_basis_label: "test",
  },
} as Listing;
describe("gross yield is the scanner's published metric", () => {
  it.each(["card", "compact", "list"] as const)(
    "renders gross, not the legacy net field (%s)",
    (density) => {
      const html = renderToStaticMarkup(createElement(ListingCard, { listing, density }));
      expect(html).toContain("4,0");
      expect(html.replace(/<[^>]*>/g, "")).not.toContain("99");
      expect(html).toContain("hrub");
    },
  );
  it("sorts by gross yield even if a stale legacy net value differs", () => {
    const higher = {
      ...listing,
      name: "higher",
      invest: { ...listing.invest!, gross_yield: 5, net_yield: 1 },
    };
    expect(sortListings([listing, higher], "yield")[0].name).toBe("higher");
  });
  it("does not export a falsely labelled net yield", () => {
    const columns = columnsFor([listing]);
    expect(columns.some((column) => column.header === "Čistý výnos")).toBe(false);
    expect(columns.find((column) => column.header === "Hrubý výnos")?.value(listing)).toBe(4);
  });
});
