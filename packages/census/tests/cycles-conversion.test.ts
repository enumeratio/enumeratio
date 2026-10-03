// Cycles (groupalgebra) <-> CycleDecomposition (combinatorics): constructor overloads across the
// two carriers, which need both libraries in one engine. `Cycles` forgets fixed points, so the way
// back takes n, and the pair round-trips: CycleDecomposition(Cycles(c), n) = c on a decomposition
// of size n. Over every permutation of n, as PermutationsAsCycles lists them.

import { expect, test } from "vite-plus/test";
import { fullEngine } from "../src/engine.ts";

const ce = fullEngine();
const evaluate = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const list = (...items: unknown[]): unknown => ["List", ...items];

test("CycleDecomposition(Cycles(c), n) = c, for every decomposition of size n up to 5", () => {
  for (let n = 0; n <= 5; n++) {
    const count = ce.box(["Count", ["PermutationsAsCycles", n]] as never).evaluate().re;
    for (let rank = 1; rank <= count; rank++) {
      const decomposition = evaluate(["At", ["PermutationsAsCycles", n], rank]);
      const cycles = evaluate(["Cycles", decomposition]);
      expect(evaluate(["CycleDecomposition", cycles, n]), JSON.stringify(decomposition)).toEqual(decomposition);
    }
  }
}, 60_000);

test("the same permutation, written either way", () => {
  const permutation = ["Permutation", list(2, 3, 1, 4)];
  const decomposition = evaluate(["CycleDecomposition", permutation]);
  expect(evaluate(["CycleDecomposition", evaluate(["Cycles", decomposition]), 4])).toEqual(decomposition);
  expect(evaluate(["Permutation", evaluate(["CycleDecomposition", ["Cycles", list(list(2, 3, 1))], 4])])).toEqual(
    evaluate(permutation),
  );
});

test("a cycle not written from its least point, and the points left out, come out canonical", () => {
  expect(evaluate(["CycleDecomposition", ["Cycles", list(list(5, 3), list(4, 2, 1))], 6])).toEqual([
    "CycleDecomposition",
    list(list(1, 4, 2), list(3, 5), list(6)),
  ]);
});

test("a point past n, a repeated point, point 0 or a negative n decline", () => {
  for (const [cycles, n] of [
    [list(list(2, 3)), 2],
    [list(list(1, 2), list(2, 3)), 3],
    [list(list(1, 2)), -1],
    [list(list(0, 1)), 2],
  ] as const) {
    const call = ["CycleDecomposition", ["Cycles", cycles], n];
    expect(evaluate(call), JSON.stringify(call)).toEqual(call);
  }
});
