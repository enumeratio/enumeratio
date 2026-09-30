// Families compiled ahead of time from their Epsil (collections/src/families/
// compiled-families.generated.js) are current, including which operations were left
// interpreted because their compiled code disagreed with the interpreter.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../collections/src/families/compiled-families.generated.js";
import { epsilEntries } from "../permutations/src/families/core.ts";
import { compiledFamilies, disagreements } from "../scripts/compile-families.ts";

test("the compiled module is current (rerun scripts/compile-families.ts)", () => {
  const current = Object.fromEntries(
    compiledFamilies().map((e) => [
      e.head,
      [e.hash, [...Object.keys(e.code), ...(e.interpreted.length > 0 ? ["interpreted"] : [])]],
    ]),
  );
  const generated = Object.fromEntries(
    Object.entries(COMPILED_FAMILIES).map(([head, e]) => [
      head,
      [e.hash, Object.keys(e).filter((key) => key !== "hash")],
    ]),
  );
  expect(generated).toEqual(current);
}, 60_000);

test("compiled code that disagrees with the interpreter is left interpreted", () => {
  const family = epsilEntries.find((f) => f.head === "SymmetricGroup")!;
  const wrong = { count: () => 0, unrank: () => [1], rank: () => 0, valid: () => true };
  expect(disagreements(new ComputeEngine(), family, wrong)).toEqual(["count", "unrank", "rank", "valid"]);
});
