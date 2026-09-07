// Combinator accelerators: Product / Concat / Window build new collections out of existing ones with O(1)
// random access (no materialization). Rank composes through them too.
import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const str = (mj: any): string => ce.box(mj).evaluate().toString();
const sym = (mj: any): string => (ce.box(mj).evaluate() as any).symbol;

describe("Product — Cartesian product with O(1) mixed-radix indexing", () => {
  it("count is the product; at is a pair", () => {
    expect(num(["Length", ["Product", ["SymmetricGroup", 3], ["Subsets", 2]]])).toBe(24); // 6·4
    expect(str(["At", ["Product", ["SymmetricGroup", 3], ["Subsets", 2]], 1])).toBe("[[1,2,3],[]]");
    // big product, random access stays instant
    expect(num(["Length", ["Product", ["SymmetricGroup", 10], ["Subsets", 20]]])).toBe(3628800 * 1048576);
  });
  it("Rank inverts At through the product", () => {
    const coll: any = ["Product", ["SymmetricGroup", 3], ["KSubsets", 4, 2]];
    const N = num(["Length", coll]);
    for (let i = 1; i <= N; i++) expect(num(["Rank", coll, ce.box(["At", coll, i]).evaluate()])).toBe(i);
  });
  it("membership requires both components", () => {
    const coll: any = ["Product", ["SymmetricGroup", 3], ["Subsets", 2]];
    expect(sym(["Element", ["List", ["List", 1, 2, 3], ["List", 1]], coll])).toBe("True");
    expect(sym(["Element", ["List", ["List", 3, 2, 1], ["List", 3]], coll])).toBe("False"); // 3 ∉ Subsets(2)
  });
});

describe("Concat — two collections end to end", () => {
  it("count adds; at routes across the seam", () => {
    const coll: any = ["Concat", ["Subsets", 2], ["SymmetricGroup", 3]];
    expect(num(["Length", coll])).toBe(4 + 6);
    expect(str(["At", coll, 4])).toBe("[1,2]"); // last of Subsets(2)
    expect(str(["At", coll, 5])).toBe("[1,2,3]"); // first of SymmetricGroup(3)
    expect(num(["Rank", coll, ce.box(["At", coll, 7]).evaluate()])).toBe(7);
  });
});

describe("Window — O(1) slice (Take/Drop/Slice without materializing)", () => {
  it("start/len subrange over a huge collection", () => {
    expect(num(["Length", ["Window", ["SymmetricGroup", 12], 100, 5]])).toBe(5);
    expect(str(["At", ["Window", ["SymmetricGroup", 4], 3, 2], 1])).toBe(str(["At", ["SymmetricGroup", 4], 3]));
    expect(str(["At", ["Window", ["SymmetricGroup", 4], 3, 2], 2])).toBe(str(["At", ["SymmetricGroup", 4], 4]));
    // window clamps to the tail
    expect(num(["Length", ["Window", ["SymmetricGroup", 4], 23, 10]])).toBe(2);
  });
});

describe("Power — k-fold Cartesian power", () => {
  it("count is base^k; element is a k-tuple; Rank inverts At", () => {
    expect(num(["Length", ["Power", ["Subsets", 2], 3]])).toBe(64); // 4^3
    expect(str(["At", ["Power", ["Subsets", 2], 3], 1])).toBe("[[],[],[]]");
    const coll: any = ["Power", ["SymmetricGroup", 3], 2];
    const N = num(["Length", coll]); // 36
    expect(N).toBe(36);
    for (let i = 1; i <= N; i++) expect(num(["Rank", coll, ce.box(["At", coll, i]).evaluate()])).toBe(i);
  });
  it("big power stays instant", () => {
    expect(num(["Length", ["Power", ["SymmetricGroup", 5], 6]])).toBe(120 ** 6);
  });
});

describe("Rank composes through views", () => {
  it("Reversed / Rotated", () => {
    expect(num(["Rank", ["Reversed", ["SymmetricGroup", 4]], ["List", 4, 3, 2, 1]])).toBe(1); // last→first
    expect(num(["Rank", ["Reversed", ["SymmetricGroup", 4]], ["List", 1, 2, 3, 4]])).toBe(24);
    const rot: any = ["Rotated", ["SymmetricGroup", 4], 1];
    const N = num(["Length", rot]);
    for (let i = 1; i <= N; i++) expect(num(["Rank", rot, ce.box(["At", rot, i]).evaluate()])).toBe(i);
  });
  it("nested: Rank through Reversed(Product(...))", () => {
    const coll: any = ["Reversed", ["Product", ["SymmetricGroup", 3], ["Subsets", 2]]];
    const N = num(["Length", coll]);
    for (let i = 1; i <= N; i++) expect(num(["Rank", coll, ce.box(["At", coll, i]).evaluate()])).toBe(i);
  });
});
