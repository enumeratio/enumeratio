// Through the engine, `Count` past 2^53 is an exact integer for every area's families, not only the
// permutations': the `count` handler can't carry it, so `Count` answers from the kernel.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

const engine = bareEngine();
declareCombinatorics(engine);
const count = (expr: unknown): unknown => engine.box(["Count", expr] as never).evaluate().json;
const exactly = (n: bigint): unknown => ({ num: n.toString() });

/** C(n, k) by the multiplicative formula. */
const binomial = (n: number, k: number): bigint => {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
};

test("Count of a trees, words, tableaux or collections family past 2^53 is exact", () => {
  expect(count(["BinaryTrees", 40])).toEqual(exactly(binomial(80, 40) / 41n));
  expect(count(["FullKAryTrees", 20, 5])).toEqual(exactly(binomial(100, 20) / 81n));
  expect(count(["NonDecreasingParkingFunctions", 40])).toEqual(exactly(binomial(80, 40) / 41n));
  expect(count(["SytTwoRow", 80])).toEqual(exactly(binomial(80, 40)));
  expect(count(["Tuples", 7, 19])).toEqual(exactly(7n ** 19n));
});

test("Count of a recurrence family past 2^53 is exact", () => {
  const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));
  /** The Bell numbers by their triangle, and Fubini by Σ C(n, k) Fubini(n − k). */
  let row = [1n];
  const fubini = [1n];
  for (let n = 1; n <= 60; n++) {
    row = row.reduce((next, x) => [...next, next[next.length - 1] + x], [row[row.length - 1]]);
    fubini.push(Array.from({ length: n }, (_, i) => binomial(n, i + 1) * fubini[n - i - 1]).reduce((a, b) => a + b));
    if (n === 40 || n === 60) {
      expect(count(["SetPartitions", n])).toEqual(exactly(row[0]));
      expect(count(["RestrictedGrowthStrings", n])).toEqual(exactly(row[0]));
    }
  }
  expect(count(["SetCompositions", 40])).toEqual(exactly(fubini[40]));
  // k! S(n, k) = Σ (−1)^(k − j) C(k, j) j^n.
  const surjections = (n: number, k: number): bigint =>
    Array.from({ length: k + 1 }, (_, j) => (-1n) ** BigInt(k - j) * binomial(k, j) * BigInt(j) ** BigInt(n)).reduce(
      (a, b) => a + b,
    );
  expect(count(["Surjections", 40, 6])).toEqual(exactly(surjections(40, 6)));
  expect(count(["SetPartitionsIntoKBlocks", 60, 7])).toEqual(exactly(surjections(60, 7) / factorial(7)));
  // Motzkin by heights.
  let heights: bigint[] = [1n, ...Array<bigint>(60).fill(0n)];
  for (let step = 0; step < 60; step++)
    heights = heights.map((_, y) => heights[y] + (heights[y - 1] ?? 0n) + (heights[y + 1] ?? 0n));
  expect(count(["MotzkinPaths", 60])).toEqual(exactly(heights[0]));
  // Boolean permutations are F(2n − 1): F(79) = 14472334024676221.
  expect(count(["BooleanPermutations", 40])).toEqual(exactly(14472334024676221n));
  // Compositions into parts of at most 2 are F(n + 1): F(81) = 37889062373143906.
  expect(count(["FibonacciCompositions", 80])).toEqual(exactly(37889062373143906n));
  // Thrall's counts over the strict shapes of 40 (summed independently in collections/tests/exact-recurrences.test.ts).
  expect(count(["ShiftedStandardTableaux", 40])).toEqual(exactly(103804204335692415040n));
  // Semistandard tableaux of every shape: the coefficient of t^n in (1 − t)^−k (1 − t²)^−C(k, 2), by series.
  const [n, k] = [40, 20];
  const series = (power: number, size: number, step: number): bigint[] =>
    Array.from({ length: size + 1 }, (_, i) => (i % step === 0 ? binomial(power + i / step - 1, i / step) : 0n));
  const [odd, even] = [series(k, n, 1), series((k * (k - 1)) / 2, n, 2)];
  const tableaux = odd.reduce((sum, x, i) => sum + x * even[n - i], 0n);
  expect(tableaux > 2n ** 53n).toBe(true);
  expect(count(["SemistandardTableaux", n, k])).toEqual(exactly(tableaux));
});

test("Count below 2^53 is still the plain number", () => {
  expect(count(["BinaryTrees", 10])).toBe(16796);
});
