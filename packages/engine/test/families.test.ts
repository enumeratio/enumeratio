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
    expect(num(["Length", ["LabeledTrees", 5]])).toBe(125); // 5^3 (Cayley)
    expect(num(["Length", ["LabeledTrees", 2]])).toBe(1);
    expect(str(["At", ["LabeledTrees", 2], 1])).toBe("[[1,2]]");
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 1, 3]], ["LabeledTrees", 3]])).toBe("True"); // path 2-1-3
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 1, 2]], ["LabeledTrees", 3]])).toBe("False"); // vertex 3 missing / repeated edge
  });
  it("batch 3 collections — counts, shape, membership", () => {
    expect(num(["Length", ["Involutions", 4]])).toBe(10); // telephone T(4)
    expect(num(["Length", ["Derangements", 4]])).toBe(9); // subfactorial !4
    expect(num(["Length", ["MotzkinPaths", 4]])).toBe(9); // Motzkin M(4)
    expect(num(["Length", ["FibonacciWords", 5]])).toBe(13); // Fibonacci
    expect(num(["Length", ["DistinctPartitions", 8]])).toBe(6); // q(8)
    expect(num(["Length", ["PartitionsInBox", 3, 3]])).toBe(20); // C(6,3)
    expect(num(["Length", ["GrayCodeSubsets", 4]])).toBe(16); // 2^4
    expect(num(["Length", ["BinaryTrees", 4]])).toBe(14); // Catalan(4)
    // shape
    expect(str(["At", ["Involutions", 3], 1])).toBe("[1,2,3]"); // identity first
    expect(str(["At", ["FibonacciWords", 3], 1])).toBe("[0,0,0]"); // all-zero first
    expect(str(["At", ["GrayCodeSubsets", 2], 2])).toBe("[1]"); // Gray order [], [1], [1,2], [2]
    expect(str(["At", ["GrayCodeSubsets", 2], 3])).toBe("[1,2]");
    expect(str(["At", ["GrayCodeSubsets", 2], 4])).toBe("[2]");
    expect(str(["At", ["BinaryTrees", 1], 1])).toBe("[0,0]"); // one node, two leaves
    expect(str(["At", ["BinaryTrees", 0], 1])).toBe("0"); // a single leaf
    // membership
    expect(sym(["Element", ["List", 2, 1, 3], ["Involutions", 3]])).toBe("True"); // (1 2)
    expect(sym(["Element", ["List", 2, 3, 1], ["Involutions", 3]])).toBe("False"); // a 3-cycle
    expect(sym(["Element", ["List", 2, 3, 1], ["Derangements", 3]])).toBe("True");
    expect(sym(["Element", ["List", 1, 3, 2], ["Derangements", 3]])).toBe("False"); // 1 is fixed
    expect(sym(["Element", ["List", 1, 0, 1], ["FibonacciWords", 3]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 0], ["FibonacciWords", 3]])).toBe("False"); // consecutive 1s
    expect(sym(["Element", ["List", 3, 2], ["PartitionsInBox", 2, 3]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 1], ["PartitionsInBox", 2, 3]])).toBe("False"); // >2 parts
    expect(sym(["Element", ["List", ["List", 0, 0]], ["BinaryTrees", 1]])).toBe("False"); // wrong node arity
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
  it("batch 4 — Schröder / ordered trees / k-ary trees", () => {
    expect(num(["Length", ["SchroderPaths", 3]])).toBe(22); // large Schröder r(3)
    expect(num(["Length", ["OrderedTrees", 4]])).toBe(14); // Catalan(4) plane trees
    expect(num(["Length", ["KAryTrees", 3, 3]])).toBe(12); // Fuss–Catalan FC(3,3)
    expect(str(["At", ["SchroderPaths", 1], 1])).toBe("[1,-1]"); // U D
    expect(str(["At", ["SchroderPaths", 1], 2])).toBe("[2]"); // one level (double) step
    expect(str(["At", ["OrderedTrees", 1], 1])).toBe("[[]]"); // root with one leaf child
    expect(str(["At", ["KAryTrees", 1, 3], 1])).toBe("[0,0,0]"); // one node, three leaves
    expect(sym(["Element", ["List", 1, 2, -1], ["SchroderPaths", 2]])).toBe("True"); // U L? width 1+2+1=4=2·2, ends 0
    expect(sym(["Element", ["List", -1, 1], ["SchroderPaths", 1]])).toBe("False"); // starts below 0
  });
  it("Surjections", () => {
    expect(num(["Length", ["Surjections", 4, 2]])).toBe(14); // 2!·S(4,2)
    expect(num(["Length", ["Surjections", 4, 4]])).toBe(24); // = 4! (bijections)
    expect(str(["At", ["Surjections", 2, 2], 1])).toBe("[1,2]");
    expect(sym(["Element", ["List", 1, 2, 1], ["Surjections", 3, 2]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 1], ["Surjections", 3, 2]])).toBe("False"); // value 2 never hit
  });
  it("cyclic perms / endofunctions / binary strings", () => {
    expect(num(["Length", ["CyclicPermutations", 4]])).toBe(6); // (4-1)!
    expect(num(["Length", ["Endofunctions", 3]])).toBe(27); // 3^3
    expect(num(["Length", ["BinaryStrings", 4]])).toBe(16); // 2^4
    expect(str(["At", ["BinaryStrings", 3], 1])).toBe("[0,0,0]");
    expect(str(["At", ["BinaryStrings", 3], 8])).toBe("[1,1,1]");
    expect(sym(["Element", ["List", 2, 3, 1], ["CyclicPermutations", 3]])).toBe("True"); // the 3-cycle (1 2 3)
    expect(sym(["Element", ["List", 2, 1, 3], ["CyclicPermutations", 3]])).toBe("False"); // (1 2)(3), not one cycle
    expect(sym(["Element", ["List", 1, 1, 3], ["Endofunctions", 3]])).toBe("True"); // repeats allowed
  });
  it("perfect matchings / bounded partitions / rooted forests", () => {
    expect(num(["Length", ["PerfectMatchings", 3]])).toBe(15); // (2·3-1)!! = 5!!
    expect(num(["Length", ["PartitionsMaxPart", 6, 2]])).toBe(4); // partitions of 6, parts ≤ 2
    expect(num(["Length", ["RootedForests", 3]])).toBe(16); // (3+1)^2
    expect(str(["At", ["PerfectMatchings", 2], 1])).toBe("[[1,2],[3,4]]"); // first matching of [4]
    expect(sym(["Element", ["List", ["List", 1, 3], ["List", 2, 4]], ["PerfectMatchings", 2]])).toBe("True");
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 2, 4]], ["PerfectMatchings", 2]])).toBe("False"); // 2 used twice
    expect(sym(["Element", ["List", 4, 2, 1], ["PartitionsMaxPart", 7, 4]])).toBe("True"); // parts ≤ 4, sum 7
    expect(sym(["Element", ["List", 5, 2], ["PartitionsMaxPart", 7, 4]])).toBe("False"); // part 5 > 4
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
    { name: "LabeledTrees(6)", coll: ["LabeledTrees", 6] },
    { name: "Involutions(6)", coll: ["Involutions", 6] },
    { name: "Derangements(6)", coll: ["Derangements", 6] },
    { name: "MotzkinPaths(7)", coll: ["MotzkinPaths", 7] },
    { name: "FibonacciWords(8)", coll: ["FibonacciWords", 8] },
    { name: "DistinctPartitions(9)", coll: ["DistinctPartitions", 9] },
    { name: "PartitionsInBox(4,4)", coll: ["PartitionsInBox", 4, 4] },
    { name: "GrayCodeSubsets(6)", coll: ["GrayCodeSubsets", 6] },
    { name: "BinaryTrees(5)", coll: ["BinaryTrees", 5] },
    { name: "SchroderPaths(5)", coll: ["SchroderPaths", 5] },
    { name: "OrderedTrees(6)", coll: ["OrderedTrees", 6] },
    { name: "KAryTrees(4,3)", coll: ["KAryTrees", 4, 3] },
    { name: "Surjections(5,3)", coll: ["Surjections", 5, 3] },
    { name: "CyclicPermutations(6)", coll: ["CyclicPermutations", 6] },
    { name: "Endofunctions(4)", coll: ["Endofunctions", 4] },
    { name: "BinaryStrings(7)", coll: ["BinaryStrings", 7] },
    { name: "PerfectMatchings(4)", coll: ["PerfectMatchings", 4] },
    { name: "PartitionsMaxPart(8,3)", coll: ["PartitionsMaxPart", 8, 3] },
    { name: "RootedForests(4)", coll: ["RootedForests", 4] },
    { name: "ParkingFunctions(4)", coll: ["ParkingFunctions", 4] },
    { name: "IncreasingTrees(5)", coll: ["IncreasingTrees", 5] },
    { name: "CompositionsIntoParts1And2(8)", coll: ["CompositionsIntoParts1And2", 8] },
    { name: "CompositionsIntoOddParts(9)", coll: ["CompositionsIntoOddParts", 9] },
    { name: "PartitionsIntoAtMostKParts(9,3)", coll: ["PartitionsIntoAtMostKParts", 9, 3] },
    { name: "GrandDyckPaths(4)", coll: ["GrandDyckPaths", 4] },
    { name: "BalancedBinaryStrings(4)", coll: ["BalancedBinaryStrings", 4] },
    { name: "CompositionsBoundedParts(8,3)", coll: ["CompositionsBoundedParts", 8, 3] },
    { name: "PalindromicBinaryStrings(9)", coll: ["PalindromicBinaryStrings", 9] },
    { name: "Triangulations(6)", coll: ["Triangulations", 6] },
    { name: "NonCrossingMatchings(5)", coll: ["NonCrossingMatchings", 5] },
    { name: "AlternatingPermutations(6)", coll: ["AlternatingPermutations", 6] },
    { name: "SetPartitionsNoSingletons(6)", coll: ["SetPartitionsNoSingletons", 6] },
    { name: "PartitionsIntoOddParts(12)", coll: ["PartitionsIntoOddParts", 12] },
    { name: "SelfConjugatePartitions(12)", coll: ["SelfConjugatePartitions", 12] },
    { name: "FullBinaryTrees(6)", coll: ["FullBinaryTrees", 6] },
    { name: "PlaneForests(6)", coll: ["PlaneForests", 6] },
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
