import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio, enumeratioLibrary, emitScalarSql } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const word = (mj: any): string =>
  ((ce.box(mj).evaluate() as any).ops ?? []).map((o: any) => Number(o.re)).join("");

describe("SymmetricGroup as a CE indexed collection", () => {
  it("Length is the closed-form count n!, no walk", () => {
    expect(num(["Length", ["SymmetricGroup", 12]])).toBe(479001600);
    expect(num(["Length", ["SymmetricGroup", 0]])).toBe(1); // 0! = 1, the empty word
  });

  // The load-bearing contract: CE `at` is 1-based, our rank is 0-based → at(i) = unrank(n, i-1).
  it("At is 1-based; a silent off-by-one here corrupts everything downstream", () => {
    expect(word(["At", ["SymmetricGroup", 5], 1])).toBe("12345"); // first = identity
    expect(word(["At", ["SymmetricGroup", 4], 1])).toBe("1234");
    expect(word(["At", ["SymmetricGroup", 4], 24])).toBe("4321"); // last (24 = 4!)
    expect(word(["At", ["SymmetricGroup", 4], -1])).toBe("4321"); // negative from the end
    expect(word(["At", ["SymmetricGroup", 4], -24])).toBe("1234");
  });

  it("At random access is O(1) at a huge index", () => {
    // 300-millionth permutation of [12], no scan.
    expect(word(["At", ["SymmetricGroup", 12], 300000000])).toBe("869104115127321");
  });

  it("Element membership = is-a-permutation-of-[n]", () => {
    const isElt = (mj: any) => (ce.box(mj).evaluate() as any).symbol;
    expect(isElt(["Element", ["List", 1, 3, 2, 4], ["SymmetricGroup", 4]])).toBe("True");
    expect(isElt(["Element", ["List", 1, 1, 2, 4], ["SymmetricGroup", 4]])).toBe("False");
    expect(isElt(["Element", ["List", 1, 2, 3], ["SymmetricGroup", 4]])).toBe("False");
  });

  it("CE's own Take iterates our handlers", () => {
    const taken = ce.box(["Take", ["SymmetricGroup", 9], 3]).evaluate().toString();
    expect(taken).toBe("[[1,2,3,4,5,6,7,8,9],[1,2,3,4,5,6,7,9,8],[1,2,3,4,5,6,8,7,9]]");
  });
});

describe("Inversions scalar stat", () => {
  it("evaluate lane composes over At", () => {
    expect(num(["Inversions", ["At", ["SymmetricGroup", 7], 1]])).toBe(0); // identity
    expect(num(["Inversions", ["At", ["SymmetricGroup", 7], 5040]])).toBe(21); // last = C(7,2)
    expect(num(["Inversions", ["List", 2, 1, 3]])).toBe(1);
    expect(num(["Inversions", ["List", 3, 2, 1]])).toBe(3);
  });
});

describe("SQL target owns snake_case emission", () => {
  it("emits a single scalar SQL expression", () => {
    const sql = emitScalarSql(ce.box(["Inversions", ["At", ["SymmetricGroup", 12], 300000000]]));
    expect(sql).toBe("perm_inversions(permutation_unrank_lex(12::int, 299999999::bigint))");
  });
  it("declines cleanly for unsupported heads", () => {
    expect(emitScalarSql(ce.box(["Length", ["SymmetricGroup", 4]]))).toBeUndefined();
  });
});

describe("library shape", () => {
  it("is a real LibraryDefinition", () => {
    expect(enumeratioLibrary.name).toBe("enumeratio");
    expect(Object.keys(enumeratioLibrary.definitions as object)).toEqual(["SymmetricGroup", "Inversions"]);
  });
});
