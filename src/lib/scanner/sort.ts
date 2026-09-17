import type { Listing, SortBy } from "./types";

/** Prices below this threshold are treated as dummy / "Cena na vyžádání" and
 *  pushed to the bottom of price-based sorts instead of polluting the top. */
const PRICE_FLOOR = 1000;

export function sortListings(arr: Listing[], sortBy: SortBy): Listing[] {
  const out = arr.slice();
  switch (sortBy) {
    case "price_asc":
      out.sort((a, b) => {
        const pa = (a.price && a.price >= PRICE_FLOOR) ? a.price : 999999999;
        const pb = (b.price && b.price >= PRICE_FLOOR) ? b.price : 999999999;
        return pa - pb;
      });
      break;
    case "price_desc":
      out.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case "yield":
      out.sort((a, b) => (b.invest?.net_yield || 0) - (a.invest?.net_yield || 0));
      break;
    case "date_desc":
      out.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
      break;
    default:
      out.sort((a, b) => a.source.localeCompare(b.source));
      break;
  }
  return out;
}
