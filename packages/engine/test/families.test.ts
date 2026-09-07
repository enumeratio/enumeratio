import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const str = (mj: any): string => ce.box(mj).evaluate().toString();
const sym = (mj: any): string => (ce.box(mj).evaluate() as any).symbol;

describe("closed-form Length across the six families (no walk)", () => {
  it("matches the known counting sequences", () => {
    expect(num(["Length", ["IntegerCompositions", 10]])).toBe(512); // 2^9
    expect(num(["Length", ["IntegerPartitions", 10]])).toBe(42); // p(10)
    expect(num(["Length", ["PartitionsIntoKParts", 10, 3]])).toBe(8); // p(10,3)
    expect(num(["Length", ["SetPartitions", 5]])).toBe(52); // Bell(5)
    expect(num(["Length", ["SetPartitionsIntoKBlocks", 5, 2]])).toBe(15); // S(5,2)
    expect(num(["Length", ["SetCompositions", 4]])).toBe(75); // Fubini(4)
  });
  it("empty families count 0", () => {
    expect(num(["Length", ["SetPartitionsIntoKBlocks", 4, 5]])).toBe(0); // S(4,5)=0
    expect(num(["Length", ["PartitionsIntoKParts", 3, 5]])).toBe(0); // no partition of 3 into 5 parts
  });
  it("branched-out collections", () => {
    expect(num(["Length", ["Subsets", 10]])).toBe(1024); // 2^10
    expect(num(["Length", ["KSubsets", 10, 3]])).toBe(120); // C(10,3)
    expect(num(["Length", ["Tuples", 3, 4]])).toBe(81); // 3^4
    expect(str(["At", ["Subsets", 3], 1])).toBe("[]"); // empty subset first
    expect(str(["At", ["Subsets", 3], 8])).toBe("[1,2,3]"); // full subset last
    expect(str(["At", ["KSubsets", 4, 2], 1])).toBe("[1,2]"); // colex first
    expect(str(["At", ["Tuples", 2, 3], 1])).toBe("[1,1,1]");
    expect(str(["At", ["Tuples", 2, 3], 8])).toBe("[2,2,2]");
    expect(sym(["Element", ["List", 2, 4], ["KSubsets", 5, 2]])).toBe("True");
    expect(sym(["Element", ["List", 2, 2], ["KSubsets", 5, 2]])).toBe("False"); // not distinct
    expect(sym(["Element", ["List", 1, 1, 2], ["Tuples", 2, 3]])).toBe("True"); // repeats ok
  });
  it("more branched-out collections — known counting sequences", () => {
    expect(num(["Length", ["DyckPaths", 5]])).toBe(42); // Catalan(5)
    expect(num(["Length", ["KPermutations", 5, 2]])).toBe(20); // 5·4
    expect(num(["Length", ["SignedPermutations", 3]])).toBe(48); // 2^3·3!
    expect(num(["Length", ["Multisets", 4, 2]])).toBe(10); // C(5,2)
    expect(num(["Length", ["CompositionsIntoKParts", 6, 3]])).toBe(10); // C(5,2)
    expect(num(["Length", ["WeakCompositions", 4, 3]])).toBe(15); // C(6,2)
    expect(num(["Length", ["LatticePaths", 2, 2]])).toBe(6); // C(4,2)
    expect(num(["Length", ["ColoredPermutations", 2, 2]])).toBe(8); // 2^2·2!
  });
  it("more branched-out — shape and membership", () => {
    expect(str(["At", ["DyckPaths", 2], 1])).toBe("[1,1,0,0]"); // uup-ddown first
    expect(str(["At", ["KPermutations", 3, 2], 1])).toBe("[1,2]");
    expect(str(["At", ["Multisets", 3, 2], 1])).toBe("[1,1]"); // non-decreasing, repeats
    expect(sym(["Element", ["List", 1, 1, 0, 0], ["DyckPaths", 2]])).toBe("True");
    expect(sym(["Element", ["List", 0, 1, 1, 0], ["DyckPaths", 2]])).toBe("False"); // dips below 0
    expect(sym(["Element", ["List", -2, 1, 3], ["SignedPermutations", 3]])).toBe("True"); // signed perm of [3]
    expect(sym(["Element", ["List", 2, 1, 3], ["Multisets", 3, 3]])).toBe("False"); // not non-decreasing
  });
});

describe("At endpoints (1-based) — the off-by-one contract holds per family", () => {
  it("integer compositions of 4 run [4] … [1,1,1,1]", () => {
    expect(str(["At", ["IntegerCompositions", 4], 1])).toBe("[4]");
    expect(str(["At", ["IntegerCompositions", 4], 8])).toBe("[1,1,1,1]");
  });
  it("integer partitions of 5 run [5] … [1,1,1,1,1]", () => {
    expect(str(["At", ["IntegerPartitions", 5], 1])).toBe("[5]");
    expect(str(["At", ["IntegerPartitions", 5], 7])).toBe("[1,1,1,1,1]");
  });
  it("set partitions of 3 run [[1,2,3]] … [[1],[2],[3]]", () => {
    expect(str(["At", ["SetPartitions", 3], 1])).toBe("[[1,2,3]]");
    expect(str(["At", ["SetPartitions", 3], 5])).toBe("[[1],[2],[3]]");
  });
  it("set compositions of 2 keep block ORDER: [[1,2]], [[1],[2]], [[2],[1]]", () => {
    expect(str(["At", ["SetCompositions", 2], 1])).toBe("[[1,2]]");
    expect(str(["At", ["SetCompositions", 2], 2])).toBe("[[1],[2]]");
    expect(str(["At", ["SetCompositions", 2], 3])).toBe("[[2],[1]]");
  });
});

describe("membership per family", () => {
  it("compositions vs partitions", () => {
    expect(sym(["Element", ["List", 2, 1, 1], ["IntegerCompositions", 4]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 1], ["IntegerCompositions", 4]])).toBe("False"); // sums to 3
    expect(sym(["Element", ["List", 3, 1, 1], ["PartitionsIntoKParts", 5, 3]])).toBe("True");
    expect(sym(["Element", ["List", 4, 1], ["PartitionsIntoKParts", 5, 3]])).toBe("False"); // 2 parts
  });
  it("set partitions", () => {
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 3]], ["SetPartitions", 3]])).toBe("True");
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 2]], ["SetPartitions", 3]])).toBe("False"); // 2 twice, 3 missing
    expect(sym(["Element", ["List", ["List", 1], ["List", 2]], ["SetPartitions", 3]])).toBe("False"); // 3 missing
  });
});

// The package's own differential, cheap by construction: enumerate the WHOLE family via At(1..N), and
// assert it is a bijection onto exactly N distinct, valid elements. An O(1) at makes this O(N) to check.
describe("enumerate-all bijection check (at is a bijection onto valid elements)", () => {
  const families: Array<{ name: string; coll: any }> = [
    { name: "SymmetricGroup(4)", coll: ["SymmetricGroup", 4] },
    { name: "IntegerCompositions(6)", coll: ["IntegerCompositions", 6] },
    { name: "IntegerPartitions(7)", coll: ["IntegerPartitions", 7] },
    { name: "PartitionsIntoKParts(9,3)", coll: ["PartitionsIntoKParts", 9, 3] },
    { name: "SetPartitions(4)", coll: ["SetPartitions", 4] },
    { name: "SetPartitionsIntoKBlocks(5,2)", coll: ["SetPartitionsIntoKBlocks", 5, 2] },
    { name: "SetCompositions(3)", coll: ["SetCompositions", 3] },
    { name: "Subsets(7)", coll: ["Subsets", 7] },
    { name: "KSubsets(8,3)", coll: ["KSubsets", 8, 3] },
    { name: "Tuples(3,4)", coll: ["Tuples", 3, 4] },
    { name: "CompositionsIntoKParts(9,3)", coll: ["CompositionsIntoKParts", 9, 3] },
    { name: "WeakCompositions(6,3)", coll: ["WeakCompositions", 6, 3] },
    { name: "Multisets(5,3)", coll: ["Multisets", 5, 3] },
    { name: "LatticePaths(4,3)", coll: ["LatticePaths", 4, 3] },
    { name: "KPermutations(6,3)", coll: ["KPermutations", 6, 3] },
    { name: "SignedPermutations(4)", coll: ["SignedPermutations", 4] },
    { name: "ColoredPermutations(3,3)", coll: ["ColoredPermutations", 3, 3] },
    { name: "DyckPaths(6)", coll: ["DyckPaths", 6] },
  ];
  for (const { name, coll } of families) {
    it(name, () => {
      const N = num(["Length", coll]);
      expect(N).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (let i = 1; i <= N; i++) {
        const el = ce.box(["At", coll, i]).evaluate();
        const s = el.toString();
        expect(el.operator === "List" || (el as any).ops != null).toBe(true); // a real element, not undefined
        seen.add(s);
        expect(sym(["Element", el, coll])).toBe("True"); // structurally a member
      }
      expect(seen.size).toBe(N); // distinct → injective on [1,N]; with count = closed form ⇒ bijection
      expect(ce.box(["At", coll, N + 1]).evaluate().operator).not.toBe("List"); // out of range → not an element
    });
  }
});
