import { describe, it, expect } from "vitest";
import {
  buildComparables,
  eligibleComparables,
  representativeSubsample,
  type CompCandidate,
  type CompSubject,
} from "../src/lib/ai/comparables";
import { evaluateInvestorRules, rulesHash, EMPTY_RULES } from "../src/lib/ai/personalize";
import { factsCacheKey, factsFingerprint, CACHE_NAMESPACE, type ListingFacts } from "../src/lib/ai/facts";

const subject: CompSubject = {
  id: "own",
  price: 6_000_000,
  area_m2: 100,
  kraj: "jihomoravsky",
  property_type: "flat",
  deal_type: "prodej",
};

function cand(id: string, price: number, area = 100, over: Partial<CompCandidate> = {}): CompCandidate {
  return {
    id,
    price,
    area_m2: area,
    city: "Brno",
    kraj: "jihomoravsky",
    property_type: "flat",
    deal_type: "prodej",
    is_active: true,
    ...over,
  };
}

describe("comparables eligibility", () => {
  it("excludes the subject itself, inactive rows, other kraj/type/deal and out-of-band areas", () => {
    const list = [
      cand("own", 1_000_000),
      cand("a", 5_000_000),
      cand("inactive", 1_000_000, 100, { is_active: false }),
      cand("otherKraj", 1_000_000, 100, { kraj: "praha" }),
      cand("otherType", 1_000_000, 100, { property_type: "house" }),
      cand("otherDeal", 1_000_000, 100, { deal_type: "pronajem" }),
      cand("tooSmall", 1_000_000, 70),
      cand("tooBig", 1_000_000, 130),
      cand("noPrice", 0, 100),
      cand("noArea", 5_000_000, 0),
    ];
    expect(eligibleComparables(subject, list).map(c => c.id)).toEqual(["a"]);
  });

  it("is order independent — median does not change when input is shuffled", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => cand(`c${i}`, i * 1_000_000, 100));
    const a = buildComparables(subject, list);
    const b = buildComparables(subject, [...list].reverse());
    const c = buildComparables(subject, [...list].sort((x, y) => (x.id < y.id ? 1 : -1)));
    expect(a.median_ppm).toBe(b.median_ppm);
    expect(a.median_ppm).toBe(c.median_ppm);
    expect(a.sample.map(s => s.id)).toEqual(b.sample.map(s => s.id));
  });

  it("computes the median from the WHOLE eligible sample, not from the cheapest prompt subsample", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => cand(`c${i}`, i * 1_000_000, 100));
    const res = buildComparables(subject, list, 8);
    expect(res.sample_count).toBe(12);
    expect(res.sample.length).toBe(8);
    // median of 10 000..120 000 Kč/m² = 65 000, NOT the median of the 8 cheapest (45 000)
    expect(res.median_ppm).toBe(65_000);
    expect(res.own_ppm).toBe(60_000);
    expect(res.pct_vs_median).toBe(-8);
  });

  it("prompt subsample spreads across the distribution and includes the median item", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => ({
      id: `c${i}`, price: i, area_m2: 1, city: null, pricePerM2: i,
    }));
    const picked = representativeSubsample(sorted, 5).map(s => s.pricePerM2);
    expect(picked[0]).toBe(1);
    expect(picked[picked.length - 1]).toBe(11);
    expect(picked).toContain(6); // median item
  });
});

describe("client cannot spoof listing facts", () => {
  it("comparable filtering uses only the server subject values", () => {
    // A client-claimed cheap price / other kraj has no representation in the API:
    // buildComparables takes the authoritative subject as its only source.
    const list = [cand("a", 5_000_000), cand("b", 7_000_000)];
    const authoritative = buildComparables(subject, list);
    const spoofed = buildComparables({ ...subject, price: 1, kraj: "praha" }, list);
    expect(authoritative.median_ppm).toBe(60_000);
    expect(spoofed.median_ppm).toBeNull(); // wrong kraj → no eligible sample
    expect(authoritative.own_ppm).not.toBe(spoofed.own_ppm);
  });
});

describe("personalisation is separated per user", () => {
  const facts = { city: "Ostrava", kraj: "moravskoslezsky", price: 6_000_000, ownership: "druzstevni", net_yield: 3.2 };

  it("two users with different rules get different personal results for the same listing", () => {
    const userA = evaluateInvestorRules(facts, { ...EMPTY_RULES, max_price: 5_000_000 });
    const userB = evaluateInvestorRules(facts, { ...EMPTY_RULES, min_net_yield: 2 });
    expect(userA.user_rule_violations.length).toBe(1);
    expect(userB.user_rule_violations.length).toBe(0);
    expect(userA).not.toEqual(userB);
  });

  it("changing a user's rules changes only that user's personal state (rules hash)", () => {
    const r1 = { ...EMPTY_RULES, max_price: 5_000_000 };
    const r2 = { ...EMPTY_RULES, max_price: 9_000_000 };
    expect(rulesHash(r1)).not.toBe(rulesHash(r2));
    // hash is order/diacritics independent → no spurious invalidation
    expect(rulesHash({ ...EMPTY_RULES, excluded_localities: ["Brno", "Ostrava"] }))
      .toBe(rulesHash({ ...EMPTY_RULES, excluded_localities: ["ostrava", "BRNO"] }));
  });

  it("flags excluded localities and non-osobni ownership", () => {
    const res = evaluateInvestorRules(facts, {
      excluded_localities: ["Ostrava"],
      min_net_yield: 5,
      max_price: null,
      require_osobni: true,
    });
    expect(res.user_rule_violations.length).toBe(3);
    expect(res.personal_notice).toContain("3");
  });
});

describe("shared factual cache", () => {
  const facts: ListingFacts = {
    id: "abc", source: "sreality", title: "Byt 3+1", city: "Brno", kraj: "jihomoravsky",
    property_type: "flat", deal_type: "prodej", house_subtype: null, price: 6_000_000,
    area_m2: 100, land_area_m2: null, ownership: "osobni", url: "https://x/y",
    description_snippet: "text", flags: [],
  };

  it("fingerprint contains no user id, rules or personal violations", () => {
    const fp = factsFingerprint(facts);
    expect(fp).not.toMatch(/user_id|user_rule_violations|min_net_yield|excluded_localities/);
  });

  it("cache key is namespaced, so pre-v2 rows can never be matched", async () => {
    const key = await factsCacheKey(facts);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    const legacy = await (async () => {
      const buf = new TextEncoder().encode(factsFingerprint(facts));
      const h = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
    })();
    expect(key).not.toBe(legacy);
    expect(CACHE_NAMESPACE).toBe("v2-impersonal");
  });

  it("same facts → same key, changed price → different key", async () => {
    expect(await factsCacheKey(facts)).toBe(await factsCacheKey({ ...facts }));
    expect(await factsCacheKey(facts)).not.toBe(await factsCacheKey({ ...facts, price: 6_100_000 }));
  });
});
