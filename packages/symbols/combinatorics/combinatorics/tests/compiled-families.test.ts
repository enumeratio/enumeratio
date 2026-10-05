// Families compiled at build from their Epsil (collections/src/families/
// compiled-families.generated.js); operations whose compiled code disagrees with the
// interpreter are left interpreted.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import { epsilEntries } from "../permutations/src/families/core.ts";
import { disagreements } from "../scripts/compile-families.ts";

test("the build compiled families", () => {
  expect(Object.keys(COMPILED_FAMILIES).length).toBeGreaterThan(0);
});

test("compiled code that disagrees with the interpreter is left interpreted", () => {
  const family = epsilEntries.find((f) => f.head === "SymmetricGroup")!;
  const wrong = { count: () => 0, unrank: () => [1], rank: () => 0, valid: () => true };
  expect(disagreements(bareEngine(), family, wrong)).toEqual(["count", "unrank", "rank", "valid"]);
});
