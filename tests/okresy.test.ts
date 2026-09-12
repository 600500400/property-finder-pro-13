import { describe, expect, it } from "vitest";
import { regionFromLocality } from "@/lib/scanner/kraj-mapping";
import { okresFromLocality } from "@/lib/scanner/okresy";

describe("locality mapping", () => {
  it("maps Mikulovice u Jeseníka without confusing it with Mikulov", () => {
    const locality = "Nábřežní, Mikulovice - Mikulovice u Jeseníka, Olomoucký kraj";
    expect(okresFromLocality(locality)).toBe("jesenik");
    expect(regionFromLocality(locality)).toBe("olomoucky");
  });

  it("maps Mikulovice u Pardubic to Pardubický kraj", () => {
    const locality = "Dlouhá, Mikulovice - Mikulovice u Pardubic, Pardubický kraj";
    expect(okresFromLocality(locality)).toBe("pardubice");
    expect(regionFromLocality(locality)).toBe("pardubicky");
  });

  it("keeps Mikulov in okres Břeclav", () => {
    expect(okresFromLocality("Mikulov")).toBe("breclav");
    expect(regionFromLocality("Mikulov, Jihomoravský kraj")).toBe("jihomoravsky");
  });

  it("keeps compound district names exact", () => {
    expect(okresFromLocality("Kuřim, okres Brno-venkov")).toBe("brno-venkov");
  });
});