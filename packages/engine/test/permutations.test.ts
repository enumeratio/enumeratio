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
  it("emits At(...) for every SQL-twinned family (generic unrank dispatch)", () => {
    const at = (mj: any) => emitScalarSql(ce.box(mj));
    expect(at(["At", ["SymmetricGroup", 12], 300000000])).toBe("permutation_unrank_lex(12::int, 299999999::bigint)");
    expect(at(["At", ["IntegerCompositions", 6], 3])).toBe("(unrank(integer_compositions(6::int), 2::bigint)).value");
    expect(at(["At", ["IntegerPartitions", 7], 5])).toBe("(unrank(integer_partitions(7::int), 4::bigint)).value");
    expect(at(["At", ["PartitionsIntoKParts", 9, 3], 2])).toBe("(unrank(k_part_partitions(9::int, 3::int), 1::bigint)).value");
    expect(at(["At", ["SetPartitions", 5], 10])).toBe("(unrank(set_partitions(5::int), 9::bigint)).value");
    expect(at(["At", ["SetPartitionsIntoKBlocks", 5, 2], 4])).toBe("(unrank(set_partitions_into_k_blocks(5::int, 2::int), 3::bigint)).value");
    expect(at(["At", ["SetCompositions", 4], 8])).toBe("(unrank(set_compositions(4::int), 7::bigint)).value");
  });
  it("declines cleanly for heads with no SQL twin", () => {
    expect(emitScalarSql(ce.box(["Length", ["SymmetricGroup", 4]]))).toBeUndefined();
    expect(emitScalarSql(ce.box(["At", ["DyckPaths", 5], 1]))).toBeUndefined(); // authored, no SQL twin
  });
});

describe("library shape", () => {
  it("is a real LibraryDefinition", () => {
    expect(enumeratioLibrary.name).toBe("enumeratio");
    const heads = Object.keys(enumeratioLibrary.definitions as object);
    expect(new Set(heads).size).toBe(heads.length); // no duplicate heads
    // 89 collections + 7 combinators + Rank/RandomElement/Inversions + 6 number + 3 digit + 7 integer/bit ops
    expect(heads.length).toBe(115);
    for (const h of ["Groupings", "BellB", "CatalanNumber", "Fubini", "PartitionsP", "PartitionsQ",
      "PolygonalNumber", "IntegerDigits", "FromDigits", "RealDigits",
      "IntegerLength", "IntegerReverse", "DigitSum", "DigitCount", "BitAnd", "BitOr", "BitXor"]) {
      expect(heads).toContain(h);
    }
    // we bind to CE's own number theory, never redeclare it
    for (const h of ["Mod", "Quotient", "GCD", "LCM", "Divisors", "Totient", "IsPrime", "Factorial", "Binomial", "Fibonacci"]) {
      expect(heads).not.toContain(h);
    }
    for (const h of ["Triangulations", "NonCrossingMatchings", "AlternatingPermutations",
      "SetPartitionsNoSingletons", "PartitionsIntoOddParts", "SelfConjugatePartitions",
      "FullBinaryTrees", "PlaneForests", "CompositionsIntoParts123", "BinaryStringsAvoiding111", "StandardYoungTableaux2xN", "LittleSchroderPaths", "NonCrossingPartitions", "NonNestingPartitions", "PalindromicCompositions", "CompositionsIntoDistinctParts", "Permutations321Avoiding", "Permutations132Avoiding", "BicoloredMotzkinPaths", "UnaryBinaryTrees", "PermutationsAvoiding231", "PermutationsAvoiding312", "SubsetsWithoutConsecutive", "CompositionsIntoPartsAtLeast2", "PermutationsAvoiding123", "PermutationsAvoiding213", "StirlingPermutations", "CompositionsIntoParts1234", "RestrictedGrowthStrings", "BinaryStringsAvoiding00", "PartitionsIntoParts1And2", "RevolvingDoorKSubsets", "CarlitzCompositions", "SmirnovWords", "KColoredCompositions", "CompositionsIntoParts12345", "BinaryStringsAvoiding101", "BinaryStringsAvoiding0101", "SetPartitionsIntoAtMostKBlocks", "BinaryStringsAvoiding010", "GrandMotzkinPaths", "DelannoyPaths"]) {
      expect(heads).toContain(h);
    }
    for (const h of ["SymmetricGroup", "CyclicPermutations", "Involutions", "Derangements", "MotzkinPaths",
      "SchroderPaths", "FibonacciWords", "DistinctPartitions", "PartitionsInBox", "PartitionsMaxPart",
      "GrayCodeSubsets", "BinaryTrees", "KAryTrees", "OrderedTrees", "LabeledTrees", "RootedForests",
      "PerfectMatchings", "Surjections", "Endofunctions", "BinaryStrings",
      "ParkingFunctions", "IncreasingTrees", "CompositionsIntoParts1And2", "CompositionsIntoOddParts",
      "PartitionsIntoAtMostKParts", "GrandDyckPaths", "BalancedBinaryStrings", "CompositionsBoundedParts",
      "PalindromicBinaryStrings", "Power", "Product", "Concat", "Window", "Reversed", "Rotated", "Zip",
      "Rank", "RandomElement", "Inversions"]) {
      expect(heads).toContain(h);
    }
  });
});
