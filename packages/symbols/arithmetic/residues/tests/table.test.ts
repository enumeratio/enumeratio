import { describe, expect, it } from "vite-plus/test";
import { additionTable, multiplicationTable, tableElements } from "../src/table.ts";

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

  it("lists ℤ/15 by its Chinese remainders, in blocks of ℤ/5 inside ℤ/3", () => {
    const crt = multiplicationTable(15, "ChineseRemainder")!;
    const rows = [...Array(15).keys()].map((i) => crt.value(i, 1, "Row"));
    expect(rows).toEqual([0, 6, 12, 3, 9, 10, 1, 7, 13, 4, 5, 11, 2, 8, 14]);
    expect(crt.autoGrid).toEqual([5, 5]);
    // A product is the same whichever way the rows are listed.
    expect(crt.value(1, 6, "Value")).toBe((6 * 1) % 15);
  });

  it("has nothing outside its rows and columns, and no table below 2", () => {
    expect(t.has(-1, 0, "IsZero")).toBeUndefined();
    expect(t.has(0, 12, "IsZero")).toBeUndefined();
    expect(multiplicationTable(1)).toBeUndefined();
  });
});

describe("ℤ/n's addition table", () => {
  const t = additionTable(12)!;

  it("holds sums, each with its additive order", () => {
    expect(t.value(5, 9, "Value")).toBe(2);
    // 3 generates the subgroup {0, 3, 6, 9}.
    expect(t.value(3, 0, "Order")).toBe(4);
    expect(t.value(0, 0, "Order")).toBe(1);
    expect(t.title).toBe("(ℤ/12, +)");
    expect(t.describe(5, 9).title).toBe("5 + 9 ≡ 2 (mod 12)");
  });

  it("is a circulant: every value once in each row", () => {
    for (let i = 0; i < 12; i++) {
      const row = new Set([...Array(12).keys()].map((j) => t.value(i, j, "Value")));
      expect(row.size).toBe(12);
    }
  });
});

describe("listing by p-adic digits", () => {
  it("orders ℤ/27 by residue mod 3, then mod 9, then mod 27", () => {
    expect(tableElements(27, "Adic").slice(0, 9)).toEqual([0, 9, 18, 3, 12, 21, 6, 15, 24]);
    expect(tableElements(9, "Adic")).toEqual([0, 3, 6, 1, 4, 7, 2, 5, 8]);
  });

  it("reads each prime power by digits after splitting by Chinese remainders", () => {
    // ℤ/12: mod 4 by its binary digits (0, 2, 1, 3), then mod 3.
    expect(tableElements(12, "Adic")).toEqual([0, 4, 8, 6, 10, 2, 9, 1, 5, 3, 7, 11]);
  });

  it("draws ℤ/pᵏ as p × p blocks of ℤ/pᵏ⁻¹'s table", () => {
    const t = multiplicationTable(27, "Adic")!;
    expect(t.autoGrid).toEqual([9, 9]);
    // Rows 0…8 are the multiples of 3: every product in that block is ≡ 0 mod 3.
    for (let i = 0; i < 9; i++) for (let j = 0; j < 27; j++) expect(t.value(i, j, "Digit(1)")).toBe(0);
  });

  it("lights a value's lifts: Congruent(n/p) is the p values above its residue mod pᵏ⁻¹", () => {
    const t = additionTable(27, "Adic")!;
    const lifts = [...Array(27).keys()].filter((j) => t.relatedTo("Congruent(9)", [0, 1], 0, j));
    // Row 0 is 0 + aⱼ: the lifts of 9 mod 9 (= 0) are 0, 9 and 18.
    expect(lifts.map((j) => t.value(0, j, "Value")).toSorted((a, b) => a! - b!)).toEqual([0, 9, 18]);
  });

  it("names the lifts one level down, and every lift of a residue mod p", () => {
    const t = multiplicationTable(27, "Adic")!;
    // Row 9 is the element 1, so its values are the elements themselves, each once.
    const one = 9;
    expect(t.value(one, 0, "Row")).toBe(1);
    const value = (j: number): number => t.value(one, j, "Value")!;
    const lit = (relation: string): number[] =>
      [...Array(27).keys()]
        .filter((j) => t.relatedTo(relation, [one, 4], one, j))
        .map(value)
        .toSorted((a, b) => a - b);
    expect(value(4)).toBe(12);
    expect(lit("Lifts")).toEqual([3, 12, 21]);
    expect(lit("SameResidue")).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
  });

  it("gives each value's p-adic valuation, 0 counted as pᵏ", () => {
    const t = multiplicationTable(27)!;
    expect(t.value(1, 18, "Valuation")).toBe(2);
    expect(t.value(1, 5, "Valuation")).toBe(0);
    expect(t.value(0, 5, "Valuation")).toBe(3);
  });
});
