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

  const t = norm(`${input.title ?? ""} ${input.description ?? ""}`);
  if (!t.trim()) return "jine";

  if (/\busedlost|\bstatek\b|\bzemedelska\s+usedlost/.test(t)) return "usedlost";
  if (/\bchata\b|\bchaty\b|\bchatu\b|\bchalup|\brekreacni\s+objekt|\brekreacni\s+chat|\bsrub\b|\bzahradni\s+domek/.test(t)) return "chalupa_chata";
  if (/\bvila\b|\bvily\b|\bvilu\b|\bvilov/.test(t)) return "vila";
  if (/\bradov[ye]?\b|\bradovk|\bdvojdom|\bdvojdomk|\brodinn\w*\s+radov/.test(t)) return "dvojdomek_radovka";
  if (/\brodinn\w*\s+d(?:um|omu|om)\b|\brodinneho\s+domu|\brd\b/.test(t)) return "rodinny_dum";
  if (/\bdomek\b|\bdum\b|\bdomu\b/.test(t)) return "rodinny_dum";
  return "jine";
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
