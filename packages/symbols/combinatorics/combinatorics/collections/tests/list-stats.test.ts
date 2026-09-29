import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

/** Evaluates and, for a lazy collection (e.g. `Take`'s own protocol-backed result), forces
 *  it into its elements -- otherwise `.json` reports the call, not the answer. See
 *  `list-stats.ts`'s own note on why `Take` can't be made eager any other way. */
const run = (expr: unknown): unknown => {
  const result = ce.box(expr as never).evaluate();
  return (result.isLazyCollection ? result.evaluate({ materialization: true }) : result).json;
};

// Take(xs, UpTo(n)): at most n, never an error for asking for more than xs holds. `Take` has
// no reference record of its own (no declared head), so this stays a unit test.
test("Take(xs, UpTo(n)) with n >= length(xs) takes everything", () => {
  expect(run(["Take", ["List", 1, 2, 3], ["UpTo", 5]])).toEqual(["List", 1, 2, 3]);
});
test("Take(xs, UpTo(n)) with n < length(xs) takes exactly n", () => {
  expect(run(["Take", ["List", 1, 2, 3, 4, 5, 6], ["UpTo", 2]])).toEqual(["List", 1, 2]);
});
test("Take(xs, n) with a plain integer is unaffected", () => {
  expect(run(["Take", ["List", 1, 2, 3, 4], 2])).toEqual(["List", 1, 2]);
});
