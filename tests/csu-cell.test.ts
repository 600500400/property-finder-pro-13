import { describe, expect, it } from "vitest";
import { parseCsuBandPrice, parseCsuCell } from "@/lib/listings/csu-cell";

describe("parseCsuCell", () => {
  it("reads plain numeric cells", () => {
    expect(parseCsuCell(44765)).toEqual({ value: 44765, lowSample: false });
  });

  it("strips the footnote marker instead of absorbing its digit", () => {
    // this exact cell produced 367321 (36 732 * 10 + 1) in the original import
    expect(parseCsuCell("   36 732  1)")).toEqual({ value: 36732, lowSample: true });
    expect(parseCsuCell("    78 541  1)")).toEqual({ value: 78541, lowSample: true });
    expect(parseCsuCell("63 986  2)")).toEqual({ value: 63986, lowSample: true });
  });

  it("treats x and i.d. as no data", () => {
    expect(parseCsuCell("x").value).toBeNull();
    expect(parseCsuCell("i.d.").value).toBeNull();
    expect(parseCsuCell("  ").value).toBeNull();
  });

  it("reports unparsable cells instead of guessing", () => {
    const cell = parseCsuCell("cca 45 000 Kč");
    expect(cell.value).toBeNull();
    expect(cell.error).toContain("unparsable");
  });

  it("rejects out-of-range band prices", () => {
    expect(parseCsuBandPrice(639861).value).toBeNull();
    expect(parseCsuBandPrice(639861).error).toContain("out of range");
    expect(parseCsuBandPrice("63 986  1)")).toEqual({ value: 63986, lowSample: true });
    expect(parseCsuBandPrice(43222).value).toBe(43222);
  });
});
