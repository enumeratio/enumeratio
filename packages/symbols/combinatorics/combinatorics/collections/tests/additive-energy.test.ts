// AdditiveEnergy / MultiplicativeEnergy: the Σ r(x)² definition against a count over every quadruple.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = bareEngine();
declareCollections(ce);
const run = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const list = (xs: readonly number[]) => ["List", ...xs];

/** Quadruples (a1, a2, b1, b2) of distinct members with a1 ∘ b1 = a2 ∘ b2, tested one by one. */
function byQuadruples(a: readonly number[], b: readonly number[], op: (x: number, y: number) => number): number {
  const [as, bs] = [[...new Set(a)], [...new Set(b)]];
  let count = 0;
  for (const a1 of as)
    for (const a2 of as) for (const b1 of bs) for (const b2 of bs) if (op(a1, b1) === op(a2, b2)) count++;
  return count;
}

const SETS: readonly (readonly number[])[] = [
  [],
  [0],
  [7],
  [1, 2, 3, 4, 5],
  [1, 2, 5, 10, 16],
  [0, 1, 2, 3],
  [-3, -1, 0, 2, 6],
  [1, 1, 2, 3],
  [2, 3, 5, 7, 11],
  [1, 2, 4, 8, 16, 32],
  [-2, -1, 1, 2],
];

for (const [head, op] of [
  ["AdditiveEnergy", (x: number, y: number) => x + y],
  ["MultiplicativeEnergy", (x: number, y: number) => x * y],
] as const) {
  test(`${head} agrees with the count over every quadruple`, () => {
    for (const a of SETS) {
      expect(run([head, list(a)]), `${head}(${JSON.stringify(a)})`).toEqual(byQuadruples(a, a, op));
      for (const b of SETS)
        expect(run([head, list(a), list(b)]), `${head}(${JSON.stringify(a)}, ${JSON.stringify(b)})`).toEqual(
          byQuadruples(a, b, op),
        );
    }
  });
}

test("a set and a range read like the list of their members", () => {
  expect(run(["AdditiveEnergy", ["Set", 1, 2, 3]])).toEqual(19);
  expect(run(["AdditiveEnergy", ["Range", 1, 10]])).toEqual(670);
  expect(run(["MultiplicativeEnergy", ["Range", 1, 5]])).toEqual(49);
});

test("exact rationals count, and the answer is the integer one scaled", () => {
  const half = ["Rational", 1, 2];
  expect(run(["AdditiveEnergy", ["List", half, 1, ["Rational", 3, 2]]])).toEqual(19);
  expect(run(["MultiplicativeEnergy", ["List", half, 1, 2]])).toEqual(19);
});

test("what is not an exact number leaves the call unevaluated", () => {
  for (const members of [
    [0.5, 1],
    ["x", 1],
  ]) {
    expect(run(["AdditiveEnergy", ["List", ...members]])).toEqual(["AdditiveEnergy", ["List", ...members]]);
  }
  expect(run(["MultiplicativeEnergy", "PrimeNumbers"])).toEqual(["MultiplicativeEnergy", "PrimeNumbers"]);
});
