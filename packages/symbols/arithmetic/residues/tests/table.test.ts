import { describe, expect, it } from "vite-plus/test";
import { multiplicationTable } from "../src/table.ts";

describe("ℤ/n's multiplication table", () => {
  const t = multiplicationTable(12)!;
  const residues = (property: string): number[] => [...Array(12).keys()].filter((v) => t.has(1, v, property));

  it("tells each product's kind", () => {
    expect(residues("IsUnit")).toEqual([1, 5, 7, 11]);
    expect(residues("IsIdempotent")).toEqual([0, 1, 4, 9]);
    expect(residues("IsNilpotent")).toEqual([0, 6]);
    expect(residues("IsSquare")).toEqual([0, 1, 4, 9]);
    expect(residues("IsInvolution")).toEqual([1, 5, 7, 11]);
    expect(t.value(5, 7, "Value")).toBe(11);
    expect(t.value(5, 1, "Order")).toBe(2);
    expect(t.value(3, 1, "Difference")).toBe(10);
  });

  it("relates cells to a selected one", () => {
    // 4 = 2·2: its square roots on the diagonal are 2, 4, 8 and 10.
    expect([...Array(12).keys()].filter((x) => t.relatedTo("SquareRoots", [2, 2], x, x))).toEqual([2, 4, 8, 10]);
    expect(t.relatedTo("Associates", [1, 2], 1, 10)).toBe(true);
    expect(t.relatedTo("Multiples", [1, 4], 1, 8)).toBe(true);
    expect(t.relatedTo("Multiples", [1, 4], 1, 6)).toBe(false);
  });

  it("has nothing outside its rows and columns, and no table below 2", () => {
    expect(t.has(-1, 0, "IsZero")).toBeUndefined();
    expect(t.has(0, 12, "IsZero")).toBeUndefined();
    expect(multiplicationTable(1)).toBeUndefined();
  });
});
