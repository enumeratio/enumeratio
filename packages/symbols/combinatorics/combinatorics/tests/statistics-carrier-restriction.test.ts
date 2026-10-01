import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics/src";
import {
  carrierNameForType,
  declareRestricted,
  declareRestrictions,
  fillPredicate,
  RESTRICTIONS,
  RestrictionCollisionError,
  type Restriction,
} from "@enumeratio/structures";

const ce = new ComputeEngine();
// A-94: declareCombinatorics (each area's own carriers + families) replaces the old bare
// declareCollections + declareCombinatoricsCarriers pair -- the restriction bases below
// (SymmetricGroup, IntegerCompositions, IntegerPartitions, ...) live in their own areas now.
// The combinatorial statistics are declared inside `declareCombinatorics` itself now (step
// 6b) — collections' own fast permutation kernels still win under several of these names
// (declarePermutations calls `declareStats` before its own `declareStatistics`).
declareCombinatorics(ce);
declareRestricted(ce);
declareRestrictions(ce, RESTRICTIONS);

const count = (expr: unknown): number => ce.box(["Count", expr] as never).evaluate().re;

/** `_x` is the bound (possibly carrier-typed) element; `_raw` is its CONTENTS -- for a
 *  carrier-typed element that is always `Carrier(contents)` (one operand), so `First` reads
 *  it back out. Bound via `Assign` rather than substituted inline, same fix (and same reason)
 *  as `declareRestrictions` itself now applies (A-94 typed every carrier-bearing family,
 *  which this differential test exercises directly -- see that function's own comment). */
const fillRestriction = (restriction: Restriction): unknown => {
  const carrier = carrierNameForType(ce, restriction.on);
  const rawInit = carrier === undefined ? "_e" : ["First", "_e"];
  return ["Block", ["Assign", "_raw", rawInit], fillPredicate(restriction.predicate, "_e", "_raw")];
};

test("an anonymous restriction is a lazy sub-collection", () => {
  // No new machinery: Restricted delegates to Filter, and Filter over a lazy collection stays
  // lazy — counting the derangements of 5 never materialises the 120 permutations.
  const derangements = ["Restricted", ["SymmetricGroup", 5], ["Function", ["Equal", ["FixedPoints", "p"], 0], "p"]];
  expect(count(derangements)).toBe(44);
  // SymmetricGroup's elements come out typed (A-94) -- `Element` needs the same shape it hands
  // back, `Permutation([...])`, not the bare list.
  expect(ce.box(["Element", ["Permutation", ["List", 2, 1, 4, 5, 3]], derangements] as never).evaluate().json).toBe(
    "True",
  );
});

test("a named restriction is an anonymous one that earned a name", () => {
  // !n for n = 0..5 — the derangement numbers.
  expect([0, 1, 2, 3, 4, 5].map((n) => count(["Derangements", n]))).toEqual([1, 0, 1, 2, 9, 44]);
  // A single n-cycle: (n-1)! of them.
  expect([1, 2, 3, 4, 5].map((n) => count(["CyclicPermutations", n]))).toEqual([1, 1, 2, 6, 24]);
});

test("a restriction does not change what its members ARE", () => {
  // The reason restrictions are sets rather than subtypes: a derangement is still a
  // permutation, so every permutation statistic still applies to it.
  const first = ce.box(["At", ["Derangements", 4], 1]).evaluate();
  expect(ce.box(["FixedPoints", first]).evaluate().re).toBe(0);
  // Whatever the kernel's first derangement is, it is a permutation and behaves like one.
  expect(ce.box(["CycleCount", first]).evaluate().re).toBeGreaterThan(0);
});

test("partition restrictions count the sequences they should", () => {
  // Partitions of n into distinct parts: 1, 1, 1, 2, 2, 3, 4, 5 for n = 0..7.
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => count(["DistinctPartitions", n]))).toEqual([1, 1, 1, 2, 2, 3, 4, 5]);
  // Self-conjugate partitions of n equal partitions into distinct ODD parts.
  expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => count(["SelfConjugatePartitions", n]))).toEqual([1, 0, 1, 1, 1, 1, 1, 2]);
});

/** Every element of a collection, as comparable strings. */
const members = (expr: unknown): string[] => {
  const total = count(expr);
  return Array.from({ length: total }, (_, i) => JSON.stringify(ce.box(["At", expr, i + 1] as never).evaluate().json));
};

test("the specification agrees with the fast kernel, element by element", () => {
  // A named restriction with a fast collection (`Derangements`, `OddCompositions`) is the same
  // family as filtering its base, in the base's order
  // (https://github.com/enumeratio/enumeratio/wiki/Speculative-Restrictions), so filtering must
  // reproduce it element by element.
  for (const restriction of RESTRICTIONS) {
    if (!ce.lookupDefinition(restriction.name)) continue;
    for (let n = 0; n <= 5; n++) {
      const specified = ["Restricted", [restriction.base, n], ["Function", fillRestriction(restriction), "_e"]];
      const kernel = [restriction.name, n];
      expect(count(specified), `${restriction.name}(${n}) count`).toBe(count(kernel));
      expect(members(specified), `${restriction.name}(${n}) members`).toEqual(members(kernel));
    }
  }
});

const COMPOSITION_RESTRICTION_NAMES = new Set([
  "OddCompositions",
  "ProperCompositions",
  "DyadicCompositions",
  "FibonacciCompositions",
  "TriCompositions",
  "TetraCompositions",
  "TriangularCompositions",
  "PrimeCompositions",
  "CarlitzCompositions",
  "PalindromicCompositions",
  "ZigzagCompositions",
]);

test("composition restrictions agree with their kernels for n = 0..8", () => {
  // Same recipe as the differential above, but out to n = 8 (composition counts
  // grow like 2^n, so this stays cheap while covering more of each family's shape than n ≤ 5).
  for (const restriction of RESTRICTIONS) {
    if (!COMPOSITION_RESTRICTION_NAMES.has(restriction.name)) continue;
    if (!ce.lookupDefinition(restriction.name)) continue;
    for (let n = 0; n <= 8; n++) {
      const specified = ["Restricted", [restriction.base, n], ["Function", fillRestriction(restriction), "_e"]];
      const kernel = [restriction.name, n];
      expect(count(specified), `${restriction.name}(${n}) count`).toBe(count(kernel));
      expect(members(specified), `${restriction.name}(${n}) members`).toEqual(members(kernel));
    }
  }
});

const PARTITION_RESTRICTION_NAMES = new Set([
  "OddPartitions",
  "PrimePartitions",
  "SquarePartitions",
  "TriangularPartitions",
]);

test("partition restrictions agree with their kernels for n = 0..8", () => {
  // Same recipe as the differential above, but out to n = 8: the kernel's elements, in order,
  // must be Filter(IntegerPartitions(n), predicate).
  for (const restriction of RESTRICTIONS) {
    if (!PARTITION_RESTRICTION_NAMES.has(restriction.name)) continue;
    if (!ce.lookupDefinition(restriction.name)) continue;
    for (let n = 0; n <= 8; n++) {
      const specified = ["Restricted", [restriction.base, n], ["Function", fillRestriction(restriction), "_e"]];
      const kernel = [restriction.name, n];
      expect(count(specified), `${restriction.name}(${n}) count`).toBe(count(kernel));
      expect(members(specified), `${restriction.name}(${n}) members`).toEqual(members(kernel));
    }
  }
});

test("every restriction names a base collection and a carrier that exist", () => {
  for (const restriction of RESTRICTIONS) {
    expect(ce.lookupDefinition(restriction.base), restriction.base).toBeTruthy();
    expect(
      CARRIERS.some((c) => c.type === restriction.on),
      restriction.on,
    ).toBe(true);
  }
});

test("a restriction's name taken by something other than its implementation is an error", () => {
  const other = new ComputeEngine();
  other.declare("SelfConjugatePartitions", { signature: "(integer) -> integer" });
  expect(() => declareRestrictions(other, RESTRICTIONS)).toThrow(RestrictionCollisionError);
});
