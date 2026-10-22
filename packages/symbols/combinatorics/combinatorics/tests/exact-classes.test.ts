// `Count` past 2^53 is exact for the partition, composition, word, tree and class families that a
// table, a Möbius sum or a closed form counts (BL-172). Past a counter's own bound a family declines.
// Expected values come from independent routes (scratch Python, not committed): Euler/σ and
// conjugation for partitions, Σ d·L(d) = k^n for Lyndon words, the generating tree for Baxter, the
// product Π(1 − x^k)^−k for plane partitions, and a memoised (remaining, previous) walk for compositions.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import {
  baxterExact,
  binomialPastDoubles,
  carlitzExact,
  distinctPartitionsExact,
  integerPartitionsExact,
  lyndonWordCountExact,
  partCountBoundedExact,
  partitionsExact,
  PASSES_2_53,
  planePartitionsExact,
  primitiveWordsExact,
  rootedUnlabeledTreesExact,
  unlabeledFreeTreesExact,
  zigzagCompositionsExact,
} from "../collections/src/families/exact-classes.ts";
import { skewShapeCount, skewShapeCountExact } from "../partitions/src/families/skew-shapes.ts";
import { declareCombinatorics } from "../src/index.ts";

const engine = bareEngine();
declareCombinatorics(engine);
const count = (head: string, args: number[]): unknown =>
  engine.box(["Count", [head, ...args]] as never).evaluate().json;

/** At or near the smallest size whose count passes 2^53 = 9007199254740992. */
const PAST_2_53: [string, number[], string][] = [
  ["IntegerPartitions", [300], "9253082936723602"],
  ["DistinctPartitions", [600], "30703043607660730"],
  ["OddPartitions", [600], "30703043607660730"],
  ["PrimePartitions", [950], "17821854928335306"],
  ["TriangularPartitions", [1900], "12308808735850038"],
  ["PartitionsIntoKParts", [450, 150], "9252700137503996"],
  ["LargestPartPartitions", [450, 150], "9252700137503996"],
  ["PartitionsMaxPart", [300, 150], "9252700137503996"],
  ["SquarePartitions", [3301], "10628930052904742"],
  ["LyndonWords", [59], "9770521225481754"],
  ["LyndonWords", [60], "19215358392200893"],
  ["KLyndonWords", [14, 20], "117028571337142830"],
  ["KLyndonWords", [30, 5], "31044085819498371984"],
  ["PrimitiveBinaryStrings", [54], "18014398375002624"],
  ["PrimitiveBinaryStrings", [60], "1152921503532053580"],
  ["BaxterPermutations", [23], "9154276618636016"],
  ["BaxterPermutations", [40], "2554987813422078288794169298972"],
  ["PlanePartitions", [94], "10740594259633282"],
  ["PlanePartitions", [120], "14057840661556747838"],
  ["RootedUnlabeledTrees", [40], "11703780079612453"],
  ["RootedUnlabeledTrees", [41], "33333125878283632"],
  ["UnlabeledFreeTrees", [44], "21835027912963086"],
  ["UnlabeledFreeTrees", [45], "60978390985918906"],
  ["PartCountBoundedCompositions", [60, 30], "288230376151711744"],
  ["PartSizeBoundedCompositions", [56, 5], "14816957550408632"],
  ["PartSizeBoundedCompositions", [100, 10], "606147434557459526483161067501"],
  ["PartSizeBoundedCompositions", [150, 40], "713623846316958381073424191750049706408935424"],
  ["CarlitzCompositions", [68], "15487089640109098"],
  ["CarlitzCompositions", [150], "1330453510383609127975205887202870700"],
  ["ZigzagCompositions", [82], "10368923174163758"],
  ["ZigzagCompositions", [120], "299953487297052541701896"],
  ["SkewPartitions", [34], "20179113525513748"],
  ["SkewPartitions", [40], "18935998838390114397"],
];

test.each(PAST_2_53)("Count(%s(%j)) past 2^53 is exact", (head, args, exact) => {
  expect(count(head, args)).toEqual({ num: exact });
});

test("a size past a counter's own bound still declines", () => {
  expect(count("SkewPartitions", [41])).toEqual(["Count", ["SkewPartitions", 41]]);
});

test("the exact counters agree with the OEIS terms they extend", () => {
  const terms = (f: (n: number) => bigint | undefined, from: number, length: number): bigint[] =>
    Array.from({ length }, (_, i) => f(from + i)!);
  expect(terms(baxterExact, 1, 8)).toEqual([1n, 2n, 6n, 22n, 92n, 422n, 2074n, 10754n]); // A001181
  expect(terms(planePartitionsExact, 0, 8)).toEqual([1n, 1n, 3n, 6n, 13n, 24n, 48n, 86n]); // A000219
  expect(terms((n) => lyndonWordCountExact(n, 2), 1, 8)).toEqual([2n, 1n, 2n, 3n, 6n, 9n, 18n, 30n]); // A001037
  expect(terms((n) => primitiveWordsExact(n, 2), 1, 8)).toEqual([2n, 2n, 6n, 12n, 30n, 54n, 126n, 240n]); // A027375
  expect(terms(rootedUnlabeledTreesExact, 1, 10)).toEqual([1n, 1n, 2n, 4n, 9n, 20n, 48n, 115n, 286n, 719n]); // A000081
  expect(terms(unlabeledFreeTreesExact, 1, 12)).toEqual([1n, 1n, 1n, 2n, 3n, 6n, 11n, 23n, 47n, 106n, 235n, 551n]); // A000055
  expect(terms(carlitzExact, 0, 8)).toEqual([1n, 1n, 1n, 3n, 4n, 7n, 14n, 23n]); // A003242
  expect(terms(zigzagCompositionsExact, 0, 6)).toEqual([1n, 1n, 1n, 3n, 4n, 7n]); // A025047
  expect(terms(integerPartitionsExact, 0, 10)).toEqual([1n, 1n, 2n, 3n, 5n, 7n, 11n, 15n, 22n, 30n]); // A000041
  expect(terms(distinctPartitionsExact, 0, 10)).toEqual([1n, 1n, 1n, 2n, 2n, 3n, 4n, 5n, 6n, 8n]); // A000009
  expect(terms((n) => partitionsExact(n, 3), 0, 10)).toEqual([1n, 1n, 2n, 3n, 4n, 5n, 7n, 8n, 10n, 12n]); // A001399
  expect(terms((n) => partCountBoundedExact(n, 2), 0, 8)).toEqual([1n, 1n, 2n, 3n, 4n, 5n, 6n, 7n]);
});

test("the exact skew count is the double table's where a double holds it", () => {
  for (let n = 0; n <= 33; n++) expect(skewShapeCountExact(n)).toBe(BigInt(skewShapeCount(n)));
  // Brute force over (λ, μ) pairs (scratch): 1, 3, 9, 28, 87, 272, 850.
  expect([1, 2, 3, 4, 5, 6, 7].map((n) => skewShapeCountExact(n))).toEqual([1n, 3n, 9n, 28n, 87n, 272n, 850n]);
});

test("Count below 2^53 is still the plain number", () => {
  expect(count("IntegerPartitions", [100])).toBe(190569292);
  expect(count("RootedUnlabeledTrees", [30])).toBe(354426847597);
  expect(count("BaxterPermutations", [10])).toBe(326240);
  expect(count("LyndonWords", [20])).toBe(52377);
  expect(count("PlanePartitions", [30])).toBe(5668963);
});

// The double kernel is skipped from each threshold on (BL-212): it is the first n whose count, and the next, pass 2^53.
const isPrime = (p: number): boolean =>
  p > 1 && Array.from({ length: Math.sqrt(p) - 1 }, (_, i) => i + 2).every((d) => p % d);
const isSquare = (p: number): boolean => Number.isInteger(Math.sqrt(p));
const isTriangular = (p: number): boolean => Number.isInteger(Math.sqrt(8 * p + 1));
const THRESHOLDS: [keyof typeof PASSES_2_53, (n: number) => bigint | undefined][] = [
  ["integerPartitions", integerPartitionsExact],
  ["distinctPartitions", distinctPartitionsExact],
  ["oddPartitions", (n) => partitionsExact(n, n, (p) => p % 2 === 1)],
  ["primePartitions", (n) => partitionsExact(n, n, isPrime)],
  ["triangularPartitions", (n) => partitionsExact(n, n, isTriangular)],
  ["squarePartitions", (n) => partitionsExact(n, n, isSquare)],
  ["carlitzCompositions", carlitzExact],
  ["zigzagCompositions", zigzagCompositionsExact],
];

test.each(THRESHOLDS)("the %s threshold is where the count first passes 2^53", (key, exact) => {
  const limit = 2n ** 53n;
  const from = PASSES_2_53[key];
  expect(exact(from - 1)! <= limit).toBe(true);
  expect(exact(from)! > limit).toBe(true);
  expect(exact(from + 1)! > limit).toBe(true);
});

test("the binomial bound holds only where C(n, r) passes 2^54", () => {
  expect(binomialPastDoubles(60, 30)).toBe(true);
  expect(binomialPastDoubles(56, 28)).toBe(false); // 7.6e15, below 2^53
  expect(binomialPastDoubles(57, 28)).toBe(false); // 1.5e16: past 2^53 but under the 2^54 margin
  expect(binomialPastDoubles(-1, -1)).toBe(false);
});
