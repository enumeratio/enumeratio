// Lazy view accelerators: Reversed / Rotated reindex the source instead of materializing it, so they are
// O(1) at any size — where CE's own Reverse/RotateLeft would materialize and refuse past maxCollectionSize.
import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const str = (mj: any): string => ce.box(mj).evaluate().toString();
const sym = (mj: any): string => (ce.box(mj).evaluate() as any).symbol;

describe("Reversed", () => {
  it("preserves Length and reverses the order (O(1), any size)", () => {
    expect(num(["Length", ["Reversed", ["Permutations", 12]]])).toBe(479001600);
    expect(str(["At", ["Reversed", ["Permutations", 4]], 1])).toBe("[4,3,2,1]"); // = At(SG(4), 24)
    expect(str(["At", ["Reversed", ["Permutations", 4]], 24])).toBe("[1,2,3,4]");
    expect(str(["At", ["Reversed", ["Permutations", 12]], 1])).toBe("[12,11,10,9,8,7,6,5,4,3,2,1]"); // instant
  });
  it("works over any collection, incl. the branched-out ones", () => {
    expect(str(["At", ["Reversed", ["Subsets", 3]], 1])).toBe("[1,2,3]"); // = At(Subsets(3), 8)
  });
  it("delegates membership to the source", () => {
    expect(sym(["Element", ["List", 4, 3, 2, 1], ["Reversed", ["Permutations", 4]]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 2, 4], ["Reversed", ["Permutations", 4]]])).toBe("False");
  });
});

describe("Rotated (rotate-left by k)", () => {
  it("at(i) = source at (i-1+k) mod N + 1", () => {
    expect(str(["At", ["Rotated", ["Permutations", 4], 1], 1])).toBe(str(["At", ["Permutations", 4], 2]));
    expect(str(["At", ["Rotated", ["Permutations", 4], 1], 24])).toBe("[1,2,3,4]"); // wraps to old first
    expect(num(["Length", ["Rotated", ["Permutations", 20], 7]])).toBe(num(["Length", ["Permutations", 20]]));
  });
  it("k beyond N wraps; negative k rotates right", () => {
    const N = 24;
    expect(str(["At", ["Rotated", ["Permutations", 4], N + 3], 1])).toBe(str(["At", ["Permutations", 4], 4]));
    expect(str(["At", ["Rotated", ["Permutations", 4], -1], 1])).toBe(str(["At", ["Permutations", 4], 24]));
  });
});

describe("views compose over each other", () => {
  it("Reversed(Rotated(...)) still O(1)", () => {
    expect(str(["At", ["Reversed", ["Rotated", ["Permutations", 4], 1]], 1]))
      .toBe(str(["At", ["Rotated", ["Permutations", 4], 1], 24]));
    expect(num(["Length", ["Reversed", ["Rotated", ["Permutations", 9], 3]]])).toBe(362880); // 9!
  });
});
