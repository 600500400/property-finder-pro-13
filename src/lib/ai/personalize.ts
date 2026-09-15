/**
 * Deterministic, server-side personalisation of an AI analysis.
 *
 * The shared AI cache may only ever hold impersonal facts. Everything that
 * depends on a specific user's investor rules is computed here — no AI call,
 * so there is nothing personal to cache.
 *
 * Pure module: no DB, no network.
 */

export interface InvestorRulesLike {
  excluded_localities: string[];
  min_net_yield: number | null;
  max_price: number | null;
  require_osobni: boolean;
}

export interface PersonalizeSubject {
  city: string | null;
  locality?: string | null;
  kraj: string | null;
  price: number;
  ownership: string | null;
  net_yield: number | null;
}

export interface PersonalResult {
  user_rule_violations: string[];
  personal_notice: string | null;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Normalised, order-independent representation of a user's rules. */
export function normalizeRules(rules: InvestorRulesLike): InvestorRulesLike {
  return {
    excluded_localities: [...new Set(rules.excluded_localities.map(s => norm(s)).filter(Boolean))].sort(),
    min_net_yield: rules.min_net_yield ?? null,
    max_price: rules.max_price ?? null,
    require_osobni: !!rules.require_osobni,
  };
}

/**
 * Stable hash/version of a user's rules. Used to key anything user-specific and
 * to prove that a rules change no longer matches the previous personal state.
 */
export function rulesHash(rules: InvestorRulesLike): string {
  return JSON.stringify(normalizeRules(rules));
}

export const EMPTY_RULES: InvestorRulesLike = {
  excluded_localities: [],
  min_net_yield: null,
  max_price: null,
  require_osobni: false,
};

export function evaluateInvestorRules(
  subject: PersonalizeSubject,
  rules: InvestorRulesLike,
): PersonalResult {
  const r = normalizeRules(rules);
  const violations: string[] = [];

  const haystack = [subject.city, subject.locality, subject.kraj]
    .filter(Boolean)
    .map(v => norm(String(v)));

  for (const loc of r.excluded_localities) {
    if (haystack.some(h => h.includes(loc) || loc.includes(h))) {
      violations.push(`Lokalita „${loc}" je na tvém seznamu vyloučených lokalit.`);
      break;
    }
  }

  if (r.max_price != null && subject.price > r.max_price) {
    violations.push(
      `Cena ${subject.price.toLocaleString("cs-CZ")} Kč přesahuje tvůj limit ${r.max_price.toLocaleString("cs-CZ")} Kč.`,
    );
  }

  if (r.min_net_yield != null) {
    if (subject.net_yield == null) {
      violations.push(`Čistý výnos nelze spočítat, takže tvůj požadavek min. ${r.min_net_yield} % nelze ověřit.`);
    } else if (subject.net_yield < r.min_net_yield) {
      violations.push(`Čistý výnos ${subject.net_yield} % je pod tvým minimem ${r.min_net_yield} %.`);
    }
  }

  if (r.require_osobni && subject.ownership && subject.ownership !== "osobni") {
    violations.push(`Vlastnictví je „${subject.ownership}", ty požaduješ pouze osobní vlastnictví.`);
  }

  const personal_notice = violations.length === 0
    ? null
    : violations.length === 1
      ? "Nabídka porušuje jedno z tvých investičních pravidel."
      : `Nabídka porušuje ${violations.length} tvá investiční pravidla.`;

  return { user_rule_violations: violations, personal_notice };
}
