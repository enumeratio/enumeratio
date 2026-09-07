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
    { name: "CompositionsIntoParts123(9)", coll: ["CompositionsIntoParts123", 9] },
    { name: "BinaryStringsAvoiding111(10)", coll: ["BinaryStringsAvoiding111", 10] },
    { name: "StandardYoungTableaux2xN(5)", coll: ["StandardYoungTableaux2xN", 5] },
    { name: "LittleSchroderPaths(5)", coll: ["LittleSchroderPaths", 5] },
    { name: "NonCrossingPartitions(6)", coll: ["NonCrossingPartitions", 6] },
    { name: "NonNestingPartitions(6)", coll: ["NonNestingPartitions", 6] },
    { name: "PalindromicCompositions(10)", coll: ["PalindromicCompositions", 10] },
    { name: "CompositionsIntoDistinctParts(9)", coll: ["CompositionsIntoDistinctParts", 9] },
    { name: "Permutations321Avoiding(6)", coll: ["Permutations321Avoiding", 6] },
    { name: "Permutations132Avoiding(6)", coll: ["Permutations132Avoiding", 6] },
    { name: "BicoloredMotzkinPaths(6)", coll: ["BicoloredMotzkinPaths", 6] },
    { name: "UnaryBinaryTrees(7)", coll: ["UnaryBinaryTrees", 7] },
    { name: "PermutationsAvoiding231(6)", coll: ["PermutationsAvoiding231", 6] },
    { name: "PermutationsAvoiding312(6)", coll: ["PermutationsAvoiding312", 6] },
    { name: "SubsetsWithoutConsecutive(8)", coll: ["SubsetsWithoutConsecutive", 8] },
    { name: "CompositionsIntoPartsAtLeast2(11)", coll: ["CompositionsIntoPartsAtLeast2", 11] },
    { name: "PermutationsAvoiding123(6)", coll: ["PermutationsAvoiding123", 6] },
    { name: "PermutationsAvoiding213(6)", coll: ["PermutationsAvoiding213", 6] },
    { name: "StirlingPermutations(5)", coll: ["StirlingPermutations", 5] },
    { name: "CompositionsIntoParts1234(9)", coll: ["CompositionsIntoParts1234", 9] },
    { name: "RestrictedGrowthStrings(6)", coll: ["RestrictedGrowthStrings", 6] },
    { name: "BinaryStringsAvoiding00(10)", coll: ["BinaryStringsAvoiding00", 10] },
    { name: "PartitionsIntoParts1And2(12)", coll: ["PartitionsIntoParts1And2", 12] },
    { name: "RevolvingDoorKSubsets(7,3)", coll: ["RevolvingDoorKSubsets", 7, 3] },
    { name: "CarlitzCompositions(9)", coll: ["CarlitzCompositions", 9] },
    { name: "SmirnovWords(5,3)", coll: ["SmirnovWords", 5, 3] },
    { name: "KColoredCompositions(6,3)", coll: ["KColoredCompositions", 6, 3] },
    { name: "CompositionsIntoParts12345(9)", coll: ["CompositionsIntoParts12345", 9] },
    { name: "BinaryStringsAvoiding101(10)", coll: ["BinaryStringsAvoiding101", 10] },
    { name: "BinaryStringsAvoiding0101(11)", coll: ["BinaryStringsAvoiding0101", 11] },
    { name: "SetPartitionsIntoAtMostKBlocks(6,3)", coll: ["SetPartitionsIntoAtMostKBlocks", 6, 3] },
    { name: "BinaryStringsAvoiding010(10)", coll: ["BinaryStringsAvoiding010", 10] },
    { name: "GrandMotzkinPaths(8)", coll: ["GrandMotzkinPaths", 8] },
    { name: "DelannoyPaths(4)", coll: ["DelannoyPaths", 4] },
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
