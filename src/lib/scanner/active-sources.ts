// Single source of truth for currently active scraper sources.
// Paused sources (realitymix, annonce, hyperinzerce) are intentionally
// excluded so the filter UI and health monitoring stay in sync.
export const ACTIVE_SOURCES = [
  "sreality",
  "bazos",
  "bezrealitky",
  "idnes",
] as const;

export type ActiveSource = (typeof ACTIVE_SOURCES)[number];

export function isActiveSource(s: string): s is ActiveSource {
  return (ACTIVE_SOURCES as readonly string[]).includes(s);
}
