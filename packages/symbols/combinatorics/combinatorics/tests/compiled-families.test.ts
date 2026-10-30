// Families compiled at build from their Epsil (collections/src/families/
// compiled-families.generated.js); operations whose compiled code disagrees with the
// interpreter are left interpreted.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import { type EpsilFamily, isEpsilFamily } from "../collections/src/families/epsil.ts";
import { allFamilies } from "../collections/src/families/index.ts";
import { definitions } from "../collections/src/families/sequence-definitions.ts";
import { dyckPaths, motzkinPaths, schroederPaths } from "../lattice-paths/src/families/core.ts";
import { epsilEntries } from "../permutations/src/families/core.ts";
import { bigDisagreements, compileFamily, deepHeads, disagreements, fibersOf } from "../scripts/family-checks.ts";

test("the build compiled families", () => {
  expect(Object.keys(COMPILED_FAMILIES).length).toBeGreaterThan(0);
});

test("compiled code that disagrees with the interpreter is left interpreted", () => {
  const family = epsilEntries.find((f) => f.head === "SymmetricGroup")!;
  const wrong = { count: () => 0, unrank: () => [1], rank: () => 0, valid: () => true };
  expect(disagreements(bareEngine(), family, wrong)).toEqual(["count", "unrank", "rank", "valid"]);
});

// The fibers the build leaves out (scripts/family-checks.ts) take the interpreter minutes, so they
// are checked here, in the nightly sweep.
test.skipIf(process.env.DEEP_TESTS !== "1")(
  "compiled code agrees with the interpreter on the fibers the build skips",
  { timeout: 900_000 },
  () => {
    const ce = bareEngine();
    for (const head of deepHeads) {
      const family = allFamilies.find((f) => f.head === head) as EpsilFamily;
      const fibers = fibersOf(family, true);
      expect(fibers.length, head).toBeGreaterThan(0);
      expect(disagreements(ce, family, compileFamily(ce, family).runs, fibers), head).toEqual([]);
    }
  },
);

test("BigInt-compiled code that disagrees with the interpreter is left interpreted", () => {
  const wrong = { count: () => 0n, unrank: () => [1n], rank: () => 0n };
  expect(bigDisagreements(bareEngine(), dyckPaths, wrong)).toEqual(["count", "unrank", "rank"]);
});

// Each opted-in family, and the first param (or rank) past 2^53 its sweep starts from.
const bigFamilies: readonly (readonly [EpsilFamily, number])[] = [
  [dyckPaths, 31],
  [definitions.get("CatalanNumbers")!, 31],
  [motzkinPaths, 39],
  [schroederPaths, 24],
];

for (const [family] of bigFamilies)
  test(`the build's BigInt-compiled ${family.head} agrees with the interpreter past 2^53`, () => {
    const ce = bareEngine();
    expect(bigDisagreements(ce, family, compileFamily(ce, family).bigRuns)).toEqual([]);
  });

// Opted in from walks and stack-walk definitions whose interpreter takes seconds to minutes a call past 2^53:
// the build's cross-check is their standard run (the generated module records its verdict), the sweep below
// repeats it here.
const slowBigFamilies: readonly (readonly [head: string, first: readonly number[]])[] = [
  ["NonCrossingTrees", [23]],
  ["BinaryTreeParentArrays", [31]],
  ["NonCrossingPartitions", [31]],
  ["NonNestingPartitions", [31]],
  ["PartCountBoundedCompositions", [55, 55]],
  ["CarlitzCompositions", [68]],
  ["ZigzagCompositions", [82]],
  ["ParkingFunctions", [15]],
];
const familyOf = (head: string): EpsilFamily => allFamilies.filter(isEpsilFamily).find((f) => f.head === head)!;

test.each(slowBigFamilies)("the build kept %s's BigInt-compiled code", (head) => {
  const entry = (COMPILED_FAMILIES as unknown as Record<string, { big?: object; bigInterpreted?: string[] }>)[head];
  // A build that stubbed the generated module has nothing to check.
  if (entry === undefined) return;
  expect(entry.bigInterpreted ?? []).toEqual([]);
  expect(Object.keys(entry.big ?? {})).toEqual(expect.arrayContaining(["count", "unrank", "rank"]));
});

// Wider than the build checks: more fibers, more ranks each.
test.skipIf(process.env.DEEP_TESTS !== "1")(
  "BigInt-compiled code agrees with the interpreter on a wide sweep past 2^53",
  { timeout: 3_600_000 },
  () => {
    const ce = bareEngine();
    // The first param climbs from where the fiber first passes 2^53; any others stay put. The slow families
    // are swept over fewer fibers and ranks.
    const sweeps = [
      ...bigFamilies.map(([family, first]) => [family, [first], 8, 8] as const),
      ...slowBigFamilies.map(([head, first]) => [familyOf(head), first, 2, 2] as const),
    ];
    for (const [family, first, count, extra] of sweeps) {
      const fibers = Array.from({ length: count }, (_, i) => [first[0]! + i, ...first.slice(1)]);
      expect(bigDisagreements(ce, family, compileFamily(ce, family).bigRuns, fibers, extra), family.head).toEqual([]);
    }
  },
);
