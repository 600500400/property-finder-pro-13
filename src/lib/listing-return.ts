export function listingActionId(action: "ai" | "save", listing: { id?: string; url: string }) {
  return action + "-" + encodeURIComponent(listing.id || listing.url);
}
/** A fragment restores focus, but never automatically spends an AI credit. */
export function listingReturnPath(
  action: "ai" | "save",
  listing: { id?: string; url: string },
  location: { pathname: string; search: string },
) {
  return location.pathname + location.search + "#" + listingActionId(action, listing);
}
