// The permutation families' Epsil definitions against independent TS readings: the same count,
// the same element at every rank, rank inverting unrank, and the same membership over every
// word near the family. Compiled and interpreted, and past 2^53 where the interpreter's exact
// integers take over.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn } from "../../collections/src/families/epsil.ts";
import { IsPermutationOf, PermutationRank, PermutationUnrank } from "../../collections/src/families/kernels.ts";
import {
  ColoredPermutationCount,
  ColoredPermutationRank,
  ColoredPermutationUnrank,
  CyclicPermutationCount,
  CyclicPermutationRank,
  CyclicPermutationUnrank,
  IsColoredPermutationOf,
  IsCyclicPermutationOf,
  DerangementCount,
  DerangementRank,
  DerangementUnrank,
  InvolutionCount,
  InvolutionRank,
  InvolutionUnrank,
  IsDerangementOf,
  IsInvolutionOf,
  IsKPermutationOf,
  IsSignedPermutationOf,
  KPermutationCount,
  KPermutationRank,
  KPermutationUnrank,
  SignedPermutationCount,
  SignedPermutationRank,
  SignedPermutationUnrank,
} from "../../collections/src/families/kernels-extra.ts";
import { epsilEntries } from "../src/families/core.ts";

const ce = new ComputeEngine();

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => unknown;
  readonly rank: (x: never, p: number[]) => number;
  readonly valid: (x: never, p: number[]) => boolean;
  /** Candidates for membership: members and near misses. */
  readonly near: (p: number[]) => unknown[];
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}
const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const READINGS: Record<string, Reading> = {
  SymmetricGroup: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => factorial(n),
    unrank: ([n], r) => PermutationUnrank(n, r),
    rank: (x: number[]) => PermutationRank(x),
    valid: (x: number[], [n]) => IsPermutationOf(x, n),
    near: ([n]) => [...words(n, span(0, n + 1)), [...span(1, n), 1]],
  },
  KPermutations: {
    params: [
      [0, 0],
      [3, 0],
      [3, 2],
      [4, 2],
      [4, 4],
      [5, 3],
      [2, 3],
    ],
    count: ([n, k]) => (k > n ? 0 : KPermutationCount(n, k)),
    unrank: ([n, k], r) => KPermutationUnrank(n, k, r),
    rank: (x: number[], [n]) => KPermutationRank(x, n),
    valid: (x: number[], [n, k]) => IsKPermutationOf(x, n, k),
    near: ([n, k]) => [...words(k, span(0, n + 1)), ...words(k + 1, span(1, n))],
  },
  SignedPermutations: {
    params: [[0], [1], [2], [3], [4]],
    count: ([n]) => SignedPermutationCount(n),
    unrank: ([n], r) => SignedPermutationUnrank(n, r),
    rank: (x: number[]) => SignedPermutationRank(x),
    valid: (x: number[], [n]) => IsSignedPermutationOf(x, n),
    near: ([n]) => words(n, span(-n - 1, n + 1)),
  },
  CyclicPermutations: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => CyclicPermutationCount(n),
    unrank: ([n], r) => CyclicPermutationUnrank(n, r),
    rank: (x: number[]) => CyclicPermutationRank(x),
    // A cyclic permutation of 0 has no members: the count says so, and so does membership.
    valid: (x: number[], [n]) => n >= 1 && IsCyclicPermutationOf(x, n),
    near: ([n]) => words(n, span(0, n + 1)),
  },
  Involutions: {
    params: [[0], [1], [2], [3], [4], [5], [6]],
    count: ([n]) => InvolutionCount(n),
    unrank: ([n], r) => InvolutionUnrank(n, r),
    rank: (x: number[]) => InvolutionRank(x),
    valid: (x: number[], [n]) => IsInvolutionOf(x, n),
    near: ([n]) => words(n, span(0, n + 1)),
  },
  Derangements: {
    params: [[0], [1], [2], [3], [4], [5], [6]],
    count: ([n]) => DerangementCount(n),
    unrank: ([n], r) => DerangementUnrank(n, r),
    rank: (x: number[]) => DerangementRank(x),
    valid: (x: number[], [n]) => IsDerangementOf(x, n),
    near: ([n]) => words(n, span(0, n + 1)),
  },
  ColoredPermutations: {
    params: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 2],
      [3, 2],
      [2, 3],
      [2, 0],
    ],
    count: ([n, k]) => ColoredPermutationCount(n, k),
    unrank: ([n, k], r) => ColoredPermutationUnrank(n, k, r),
    rank: (x: number[][], [, k]) => ColoredPermutationRank(x[0], x[1], k),
    valid: (x: number[][], [n, k]) => x.length === 2 && IsColoredPermutationOf(x[0], x[1], n, k),
    near: ([n, k]) =>
      words(n, span(0, n + 1)).flatMap((image) => words(n, span(-1, k)).map((colours) => [image, colours])),
  },
};

const byHead = new Map(epsilEntries.map((family) => [family.head, family]));

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
        expect(reading.rank(element as never, p)).toBe(r);
      }
      for (const candidate of reading.near(p))
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, reading.valid(candidate as never, p)]);
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) =>
  evaluateEpsil(ce, family.epsil[operation], bindings);

const list = (xs: unknown[]): unknown => ["List", ...xs.map((x) => (Array.isArray(x) ? list(x) : x))];

test("the interpreter agrees with compiled code", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = byHead.get(head)!;
    const p = reading.params.at(-2)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of [0, Math.floor(total / 2), total - 1]) {
      const element = reading.unrank(p, r);
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(list(element as unknown[]));
      expect(interpreted(family, "rank", { ...bind, _x: list(element as unknown[]) })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: list(element as unknown[]) })).toBe("True");
    }
  }
});

test("past 2^53 the symmetric group answers in exact integers", () => {
  const kernel = kernelOn(ce, byHead.get("SymmetricGroup")!);
  let total = 1n;
  for (let i = 2n; i <= 25n; i++) total *= i;
  expect(kernel.count([25])).toBe(total);
  const last = span(1, 25).toReversed();
  expect(kernel.unrank([25], total - 1n)).toEqual(last);
  expect(kernel.rank(last, [25])).toBe(total - 1n);
  const middle = kernel.unrank([25], total / 3n);
  expect(kernel.rank(middle, [25])).toBe(total / 3n);
});
