// Families compiled at build from their Epsil (collections/src/families/
// compiled-families.generated.js); operations whose compiled code disagrees with the
// interpreter are left interpreted.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import type { EpsilFamily } from "../collections/src/families/epsil.ts";
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

// Wider than the build checks: more fibers, more ranks each.
test.skipIf(process.env.DEEP_TESTS !== "1")(
  "BigInt-compiled code agrees with the interpreter on a wide sweep past 2^53",
  { timeout: 900_000 },
  () => {
    const ce = bareEngine();
    for (const [family, first] of bigFamilies) {
      const fibers = Array.from({ length: 8 }, (_, i) => [first + i]);
      expect(bigDisagreements(ce, family, compileFamily(ce, family).bigRuns, fibers, 8), family.head).toEqual([]);
    }
  },
);
