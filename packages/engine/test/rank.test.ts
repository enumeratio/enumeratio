// Rank (element → index) is the half CE lacks entirely. These pin it as the exact inverse of At across
// every family, and check RandomElement lands inside the collection.
import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);

describe("Rank is the inverse of At", () => {
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
  ];
  for (const { name, coll } of families) {
    it(`Rank(c, At(c, i)) === i for all i — ${name}`, () => {
      const N = num(["Length", coll]);
      for (let i = 1; i <= N; i++) {
        const el = ce.box(["At", coll, i]).evaluate();
        expect(num(["Rank", coll, el])).toBe(i);
      }
    });
  }

  it("named endpoints", () => {
    expect(num(["Rank", ["SymmetricGroup", 4], ["List", 1, 2, 3, 4]])).toBe(1);
    expect(num(["Rank", ["SymmetricGroup", 4], ["List", 4, 3, 2, 1]])).toBe(24);
    expect(num(["Rank", ["IntegerCompositions", 4], ["List", 4]])).toBe(1);
    expect(num(["Rank", ["IntegerCompositions", 4], ["List", 1, 1, 1, 1]])).toBe(8);
    // set partition given in non-canonical block order still ranks correctly (canonicalized internally)
    expect(num(["Rank", ["SetPartitions", 3], ["List", ["List", 2], ["List", 1, 3]]])).toBe(
      num(["Rank", ["SetPartitions", 3], ["List", ["List", 1, 3], ["List", 2]]]),
    );
  });

  it("declines (stays symbolic) for a non-member", () => {
    const e: any = ce.box(["Rank", ["SymmetricGroup", 4], ["List", 1, 1, 2, 4]]).evaluate();
    expect(e.operator).toBe("Rank"); // not a number — [1,1,2,4] is not a permutation of [4]
  });
});

describe("RandomElement lands inside the collection", () => {
  const samples = (coll: any, n: number) =>
    Array.from({ length: n }, () => ce.box(["RandomElement", coll]).evaluate());
  it("SymmetricGroup", () => {
    for (const el of samples(["SymmetricGroup", 5], 20)) {
      expect((el as any).ops.length).toBe(5);
      expect((ce.box(["Element", el, ["SymmetricGroup", 5]]).evaluate() as any).symbol).toBe("True");
    }
  });
  it("SetPartitions", () => {
    for (const el of samples(["SetPartitions", 4], 20)) {
      expect((ce.box(["Element", el, ["SetPartitions", 4]]).evaluate() as any).symbol).toBe("True");
    }
  });
});
