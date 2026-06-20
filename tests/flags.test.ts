import { describe, it, expect } from "vitest";
import { detectFlags, hasPriceTrap } from "@/lib/scanner/flags";

describe("detectFlags", () => {
  it("detects price_trap: anuita", () => {
    const flags = detectFlags({ description: "Cena je po odečtení anuity družstvu." });
    expect(flags.some(f => f.code === "anuita" && f.category === "price_trap")).toBe(true);
    expect(hasPriceTrap(flags)).toBe(true);
  });

  it("detects price_trap: doplatek", () => {
    const flags = detectFlags({ description: "Doplatek úvěru ve výši 1 200 000 Kč." });
    expect(flags.some(f => f.code === "doplatek")).toBe(true);
  });

  it("detects price_trap: provize", () => {
    const flags = detectFlags({ description: "K ceně + provize RK 4%." });
    expect(flags.some(f => f.code === "provize")).toBe(true);
    expect(hasPriceTrap(flags)).toBe(true);
  });

  it("detects foreign-property when no CZ kraj", () => {
    const flags = detectFlags({ title: "Apartmán u moře", description: "Krásný byt ve Španělsku, Costa Blanca." });
    expect(flags.some(f => f.category === "foreign")).toBe(true);
  });

  it("does NOT flag foreign when a recognized CZ kraj is set", () => {
    const flags = detectFlags({
      description: "Byt v centru, klientka má i dům ve Španělsku.",
      kraj: "praha",
    });
    expect(flags.some(f => f.category === "foreign")).toBe(false);
  });

  it("detects type_nuance: družstevní + před rekonstrukcí", () => {
    const flags = detectFlags({ description: "Družstevní byt před rekonstrukcí, nutná oprava." });
    expect(flags.some(f => f.code === "druzstevni")).toBe(true);
    expect(flags.some(f => f.code === "pred_rek")).toBe(true);
  });

  it("returns no flags for clean text", () => {
    const flags = detectFlags({ title: "2+kk", description: "Slunný byt s balkonem.", kraj: "praha" });
    expect(flags).toHaveLength(0);
    expect(hasPriceTrap(flags)).toBe(false);
  });
});
