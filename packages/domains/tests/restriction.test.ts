import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections/src";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import {
  declareRestricted,
  declareRestrictions,
  fillPredicate,
  RESTRICTIONS,
} from "../src/restriction.ts";

const ce = new ComputeEngine();
declareCollections(ce);
declareDomains(ce);
// collections ships its own fast permutation statistics under several of these names, and a
// second declaration throws — so the caller says which wins. See DeclareOptions.skipDeclared.
declareStatistics(ce, ALL_STATISTICS, { skipDeclared: true });
declareRestricted(ce);
declareRestrictions(ce, RESTRICTIONS, { skipDeclared: true });

const count = (expr: unknown): number => ce.box(["Count", expr] as never).evaluate().re;

test("an anonymous restriction is a lazy sub-collection", () => {
  // No new machinery: Restricted delegates to Filter, and Filter over a lazy collection stays
  // lazy — counting the derangements of 5 never materialises the 120 permutations.
  const derangements = [
    "Restricted",
    ["SymmetricGroup", 5],
    ["Function", ["Equal", ["FixedPoints", "p"], 0], "p"],
  ];
  expect(count(derangements)).toBe(44);
  expect(ce.box(["Element", ["List", 2, 1, 4, 5, 3], derangements] as never).evaluate().json).toBe(
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
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => count(["DistinctPartitions", n]))).toEqual([
    1, 1, 1, 2, 2, 3, 4, 5,
  ]);
  // Self-conjugate partitions of n equal partitions into distinct ODD parts.
  expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => count(["SelfConjugatePartitions", n]))).toEqual([
    1, 0, 1, 1, 1, 1, 1, 2,
  ]);
});

/** Every element of a collection, as comparable strings. */
const members = (expr: unknown): string[] => {
  const total = count(expr);
  return Array.from({ length: total }, (_, i) =>
    JSON.stringify(ce.box(["At", expr, i + 1] as never).evaluate().json),
  );
};

test("the specification agrees with the fast kernel — as a SET", () => {
  // `Derangements` and `CyclicPermutations` already exist as hand-written collections with
  // their own count and unrank. The restriction is the SPECIFICATION of the same family, so
  // filtering the base must reproduce it — the reference/accelerated differential this
  // project runs everywhere else, arriving for collections.
  //
  // It agrees on membership and disagrees on ORDER: filtering S4 gives [2,1,4,3] first,
  // while the kernel gives [4,3,2,1]. Neither is wrong. A restriction says WHICH elements,
  // not in what sequence — enumeratio gives each collection its own canonical order, and a
  // restricted collection's order is its own data rather than the parent's induced one.
  // That is more evidence for §4: a restriction is a set.
  for (const restriction of RESTRICTIONS) {
    if (!ce.lookupDefinition(restriction.name)) continue;
    for (let n = 0; n <= 5; n++) {
      const specified = [
        "Restricted",
        [restriction.base, n],
        ["Function", fillPredicate(restriction.predicate, "_e", "_e"), "_e"],
      ];
      const kernel = [restriction.name, n];
      expect(count(specified), `${restriction.name}(${n}) count`).toBe(count(kernel));
      expect(members(specified).sort(), `${restriction.name}(${n}) members`).toEqual(
        members(kernel).sort(),
      );
    }
  }
});

test("every restriction names a base collection and a carrier that exist", () => {
  for (const restriction of RESTRICTIONS) {
    expect(ce.lookupDefinition(restriction.base), restriction.base).toBeTruthy();
    expect(
      DOMAINS.some((d) => d.type === restriction.on),
      restriction.on,
    ).toBe(true);
  }
});
