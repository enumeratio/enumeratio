// The lattice-path families defined in Epsil (BL-30's DP phase): against their independent TS
// readings, the same count, the same element at every rank, rank inverting unrank, and the same
// membership over every near-miss word. Compiled and interpreted, and the interpreter checked
// directly against the definitions too.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn } from "../../collections/src/families/epsil.ts";
import {
  DyckPathCount,
  DyckPathRank,
  DyckPathUnrank,
  IsDyckPath,
  IsMotzkinPath,
  IsSchroederPath,
  MotzkinCount,
  MotzkinRank,
  MotzkinUnrank,
  SchroederCount,
  SchroederRank,
  SchroederUnrank,
} from "../../collections/src/families/kernels-extra.ts";
import { entries as coreEntries } from "../src/families/core.ts";
import {
  DyckPathsByHeightCount,
  DyckPathsByHeightRank,
  DyckPathsByHeightUnrank,
  entries as pathsEntries,
  isDyckPathsByHeightOf,
} from "../src/families/paths-partitions.ts";

const ce = new ComputeEngine();

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => number[];
  readonly rank: (x: number[], p: number[]) => number;
  readonly valid: (x: number[], p: number[]) => boolean;
  readonly near: (p: number[]) => number[][];
}

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}
/** Every word of length `length` over `alphabet`, and one step shorter and longer. */
const around = (length: number, alphabet: readonly number[]): number[][] => [
  ...words(length, alphabet),
  ...(length > 0 ? words(length - 1, alphabet) : []),
  ...words(length + 1, alphabet),
];

const READINGS: Record<string, Reading> = {
  DyckPaths: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => DyckPathUnrank(n, r),
    rank: (x) => DyckPathRank(x),
    valid: (x, [n]) => IsDyckPath(x, n),
    near: ([n]) => (n <= 3 ? around(2 * n, [-1, 0, 1, 2]) : around(2 * n, [0, 1])),
  },
  MotzkinPaths: {
    params: [[0], [1], [2], [3], [4], [6]],
    count: ([n]) => MotzkinCount(n),
    unrank: ([n], r) => MotzkinUnrank(n, r),
    rank: (x) => MotzkinRank(x),
    valid: (x, [n]) => IsMotzkinPath(x, n),
    near: ([n]) => (n <= 4 ? around(n, [-2, -1, 0, 1, 2]) : around(n, [-1, 0, 1])),
  },
  SchroederPaths: {
    params: [[0], [1], [2], [3]],
    count: ([n]) => SchroederCount(n),
    unrank: ([n], r) => SchroederUnrank(n, r),
    rank: (x) => SchroederRank(x),
    valid: (x, [n]) => IsSchroederPath(x, n),
    // Its words vary in length: every word up to one step past the longest member.
    near: ([n]) => Array.from({ length: 2 * n + 2 }, (_, l) => words(l, [-1, 0, 1, 2])).flat(),
  },
  DyckPathsByHeight: {
    params: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 1],
      [3, 2],
      [3, 3],
      [5, 2],
      [5, 3],
      [6, 4],
    ],
    count: ([n, h]) => DyckPathsByHeightCount(n, h),
    unrank: ([n, h], r) => DyckPathsByHeightUnrank(n, h, r),
    rank: (x, [, h]) => DyckPathsByHeightRank(x, h),
    valid: (x, [n, h]) => isDyckPathsByHeightOf(x, n, h),
    near: ([n]) => around(2 * n, [0, 1]),
  },
};

const byHead = new Map(
  [...coreEntries, ...pathsEntries].filter((f) => "epsil" in f).map((f) => [f.head, f as EpsilFamily]),
);

for (const [head, reading] of Object.entries(READINGS)) {
  const family = byHead.get(head)!;
  const kernel = kernelOn(ce, family);
  for (const p of reading.params) {
    test(`${head}(${p.join(", ")}) agrees with its TS reading`, () => {
      const total = reading.count(p);
      expect(kernel.count(p)).toBe(BigInt(total));
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r));
        expect(element).toEqual(reading.unrank(p, r));
        expect(kernel.rank(element, p)).toBe(BigInt(r));
      }
      for (const candidate of reading.near(p))
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, reading.valid(candidate, p)]);
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) =>
  evaluateEpsil(ce, family.epsil[operation], bindings);

test("the interpreter agrees with compiled code", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = byHead.get(head)!;
    const p = reading.params.at(-2)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of [0, Math.floor(total / 2), total - 1]) {
      const element = reading.unrank(p, r);
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(["List", ...element]);
      expect(interpreted(family, "rank", { ...bind, _x: ["List", ...element] })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: ["List", ...element] })).toBe("True");
    }
  }
});

test("past 2^53 DyckPaths answers in exact integers", () => {
  const kernel = kernelOn(ce, byHead.get("DyckPaths")!);
  const n = 40; // Catalan(40) is about 2.6·10^21
  const total = kernel.count([n]) as bigint;
  expect(total).toBe(2622127042276492108820n);
  // Rank 0 climbs first, the last rank zigzags.
  expect(kernel.unrank([n], 0n)).toEqual([
    ...Array.from({ length: n }, () => 1),
    ...Array.from({ length: n }, () => 0),
  ]);
  const last = kernel.unrank([n], total - 1n) as number[];
  expect(last).toEqual(Array.from({ length: 2 * n }, (_, i) => (i % 2 === 0 ? 1 : 0)));
  expect(kernel.rank(last, [n])).toBe(total - 1n);
  const middle = kernel.unrank([n], total / 3n);
  expect(kernel.rank(middle, [n])).toBe(total / 3n);
});
