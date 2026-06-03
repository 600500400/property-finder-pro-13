import type { Listing, SortBy } from "./types";

export function sortListings(arr: Listing[], sortBy: SortBy): Listing[] {
  const out = arr.slice();
  switch (sortBy) {
    case "price_asc":
      out.sort((a, b) => (a.price || 999999999) - (b.price || 999999999));
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
