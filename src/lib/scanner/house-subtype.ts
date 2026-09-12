// Internal house subtype classification. Never exposed as a UI filter — it exists
// so the price/m² median only compares like with like (rodinný dům vs. chata).

export type HouseSubtype =
  | "rodinny_dum"
  | "vila"
  | "chalupa_chata"
  | "usedlost"
  | "dvojdomek_radovka"
  | "jine";

export type SubtypeGroup = "standard" | "rekreace" | "jine";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Source category (Sreality title / Bezrealitky estateType) wins, keywords are the fallback. */
export function deriveHouseSubtype(input: {
  title?: string | null;
  description?: string | null;
  sourceCategory?: string | null;
}): HouseSubtype {
  const cat = norm(input.sourceCategory ?? "");
  if (cat.includes("rekreacni")) return "chalupa_chata";

  // The title carries the portal's own category wording, so classify from it first
  // and only fall back to the description when the title says nothing useful.
  const fromTitle = classify(norm(input.title ?? ""));
  if (fromTitle) return fromTitle;
  return classify(norm(input.description ?? "")) ?? "jine";
}

function classify(t: string): HouseSubtype | null {
  if (!t.trim()) return null;
  if (/\busedlost|\bstatek\b|\bstatku\b/.test(t)) return "usedlost";
  if (/\bchata\b|\bchaty\b|\bchatu\b|\bchalup|\brekreacni\s+objekt|\bsrub\b|\bzahradni\s+domek/.test(t)) return "chalupa_chata";
  if (/\bvila\b|\bvily\b|\bvilu\b|\bvilov/.test(t)) return "vila";
  if (/\bradov[ye]?\b|\bradovk|\bdvojdom/.test(t)) return "dvojdomek_radovka";
  if (/\brodinn|\bdomek\b|\bdum\b|\bdomu\b|\brd\b/.test(t)) return "rodinny_dum";
  return null;
}

/** Comparable pools: family homes / villas / terraced together, recreational together. */
export function subtypeGroup(s: HouseSubtype | null | undefined): SubtypeGroup {
  switch (s) {
    case "rodinny_dum":
    case "vila":
    case "dvojdomek_radovka":
      return "standard";
    case "chalupa_chata":
    case "usedlost":
      return "rekreace";
    default:
      return "jine";
  }
}
