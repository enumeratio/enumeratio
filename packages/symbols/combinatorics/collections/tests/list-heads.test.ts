import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Ordering(collection, n): the first n indices of the full ordering.
test("Ordering(c, n) agrees with the first n of Ordering(c)", () => {
  const list = ["List", 2, 6, 1, 9, 1, 2, 3];
  const full = run(["Ordering", list]) as readonly unknown[];
  for (let n = 0; n <= 7; n++) {
    expect(run(["Ordering", list, n])).toEqual(["List", ...full.slice(1, n + 1)]);
  }
});

// Lane B-35 regression: notatio's editor flagged the 1-argument form as a type error before
// this widening landed. Pin that boxing produces no `Error` node -- what notatio's type
// check marks red -- not just that evaluation happens to still work.
test("Clamp(x) boxes without a type error", () => {
  const boxed = ce.box(["Clamp", 1.5]);
  expect(JSON.stringify(boxed.json)).not.toContain("Error");
  expect(boxed.evaluate().json).toEqual(1);
});

// Regression: the rule is guarded to exactly 1 argument. Before the guard, `applies`
// accepted any arity, so a malformed 2-arg call's native Error result was also silently
// rewritten to 0 by this rule instead of staying an Error.
test("Length(x, y) at the wrong arity is not answered by the atom rule", () => {
  const result = run(["Length", 5, 6]) as readonly unknown[];
  expect(result[0]).toEqual("Error");
});

// Commonest: every tied mode, unlike Mode which returns just one.
test("Commonest agrees with a brute-force tally, for every subset of 1..5 repeated", () => {
  const values = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4];
  for (let mask = 1; mask < 1 << values.length; mask++) {
    const subset = values.filter((_, i) => (mask & (1 << i)) !== 0);
    const tally = new Map<number, number>();
    for (const v of subset) tally.set(v, (tally.get(v) ?? 0) + 1);
    const max = Math.max(...tally.values());
    const expected = [...tally.entries()].filter(([, c]) => c === max).map(([v]) => v);
    // First-seen order, matching the implementation.
    const firstSeen = subset.filter((v, i) => subset.indexOf(v) === i && expected.includes(v));
    expect(run(["Commonest", ["List", ...subset]])).toEqual(["List", ...firstSeen]);
  }
});

// Position: every matching index, wrapped, unlike IndexOf which reports only the first.
test("Position's first entry agrees with IndexOf", () => {
  const list = ["List", 1, 2, 3, 2];
  const indexOf = run(["IndexOf", list, 2]);
  const positions = run(["Position", list, 2]) as readonly unknown[];
  expect(positions[1]).toEqual(["List", indexOf]);
});
