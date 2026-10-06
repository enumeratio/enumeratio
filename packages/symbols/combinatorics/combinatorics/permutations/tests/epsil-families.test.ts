// The permutation families' Epsil definitions against independent TS readings: the same count,
// the same element at every rank, rank inverting unrank, and the same membership over every
// word near the family. Compiled and interpreted, and past 2^53 where the interpreter's exact
// integers take over.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { IsPermutationOf, PermutationRank, PermutationUnrank } from "../../collections/src/families/kernels.ts";
import {
  ColoredPermutationCount,
  ColoredPermutationRank,
  ColoredPermutationUnrank,
  IsColoredPermutationOf,
  IsCyclicPermutationOf,
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
import { epsilEntries, kCyclePermutations } from "../src/families/core.ts";
import { permutationsAsCycles } from "../src/families/cycles.ts";
import { PermutationsAsCyclesFamily } from "../src/families/permutations.ts";
import {
  alternatingPermutations,
  cograssmannianPermutations,
  connectedPermutations,
  grassmannianPermutations,
  kDescentPermutations,
  nonCrossingCycleSupportPermutations,
  permutationsAvoiding3,
  separablePermutations,
  vexillaryPermutations,
} from "../src/families/restrictions.ts";

const ce = bareEngine();

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => unknown;
  readonly rank: (x: never, p: number[]) => number;
  readonly valid: (x: never, p: number[]) => boolean;
  /** Candidates for membership: members and near misses. */
  readonly near: (p: number[]) => unknown[];
  /** Params for the interpreter check, where the second-last take it minutes. */
  readonly interpretAt?: number[];
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}
const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** How many adjacent pairs `turn` holds for. */
const turns = (x: readonly number[], turn: (a: number, b: number) => boolean): number =>
  x.slice(1).filter((v, i) => turn(x[i], v)).length;

/** The number of cycles of a permutation word. */
function cycles(x: readonly number[]): number {
  const seen = new Set<number>();
  let count = 0;
  for (let i = 1; i <= x.length; i++) {
    if (seen.has(i)) continue;
    count++;
    for (let j = i; !seen.has(j); j = x[j - 1]) seen.add(j);
  }
  return count;
}

/** Whether `x` has entries at i < j < k in the relative order of `pattern`. */
function contains(x: readonly number[], pattern: string): boolean {
  const [a, b, c] = pattern.split("").map(Number);
  const agrees = (u: number, v: number, p: number, q: number) => p < q === u < v;
  for (let k = 0; k < x.length; k++)
    for (let j = 0; j < k; j++)
      for (let i = 0; i < j; i++)
        if (agrees(x[i], x[j], a, b) && agrees(x[j], x[k], b, c) && agrees(x[i], x[k], a, c)) return true;
  return false;
}

/** Whether two of `x`'s cycles cross: a < b < c < d with a, c in one and b, d in another. */
function crossing(x: readonly number[]): boolean {
  const cycleOf: number[] = [];
  for (let s = 1; s <= x.length; s++)
    if (cycleOf[s] === undefined) for (let v = s; cycleOf[v] === undefined; v = x[v - 1]) cycleOf[v] = s;
  for (let a = 1; a <= x.length; a++)
    for (let b = a + 1; b <= x.length; b++)
      for (let c = b + 1; c <= x.length; c++)
        for (let d = c + 1; d <= x.length; d++)
          if (cycleOf[a] === cycleOf[c] && cycleOf[b] === cycleOf[d] && cycleOf[a] !== cycleOf[b]) return true;
  return false;
}

/** Whether `x` has entries at a < b < c < d in the relative order of `pattern`. */
function contains4(x: readonly number[], pattern: string): boolean {
  const want = pattern.split("").map(Number);
  for (let d = 0; d < x.length; d++)
    for (let c = 0; c < d; c++)
      for (let b = 0; b < c; b++)
        for (let a = 0; a < b; a++) {
          const vs = [x[a], x[b], x[c], x[d]];
          if (vs.every((v, i) => vs.filter((u) => u < v).length + 1 === want[i])) return true;
        }
  return false;
}

/** Whether `x` has entries at a < b < c < d reading 2413 or 3142. */
function separates(x: readonly number[]): boolean {
  for (let d = 0; d < x.length; d++)
    for (let c = 0; c < d; c++)
      for (let b = 0; b < c; b++)
        for (let a = 0; a < b; a++) {
          const [w, y, z, v] = [x[a], x[b], x[c], x[d]];
          if ((z < w && w < v && v < y) || (y < v && v < w && w < z)) return true;
        }
  return false;
}

/** A restriction of the symmetric group read by filtering it: its members of n, in lex order. */
function lexRestriction(params: number[][], member: (x: number[], p: number[]) => boolean): Reading {
  const members = (p: number[]): number[][] =>
    Array.from({ length: factorial(p[0]) }, (_, r) => PermutationUnrank(p[0], r)).filter((x) => member(x, p));
  return {
    params,
    count: (p) => members(p).length,
    unrank: (p, r) => members(p)[r],
    rank: (x: number[], p) => members(p).findIndex((m) => m.join() === x.join()),
    valid: (x: number[], p) => Array.isArray(x) && x.length === p[0] && IsPermutationOf(x, p[0]) && member(x, p),
    near: ([n]) => words(n, span(0, n + 1)),
  };
}

/** Decompositions a step from a member: its cycles reversed, one cycle rotated, one cycle
 *  dropped, a fixed point added, a point repeated. */
function cycleNeighbours(cycles: number[][]): number[][][] {
  const rotated = cycles.map((c, i) => cycles.map((d, j) => (i === j ? [...d.slice(1), d[0]] : d)));
  return [
    cycles.toReversed(),
    ...rotated,
    cycles.slice(1),
    [...cycles, [cycles.flat().length + 1]],
    cycles.map((c, i) => (i === 0 ? [...c, c[0]] : c)),
    [...cycles, []],
  ];
}

const READINGS: Record<string, Reading> = {
  // The TS kernel enumerates every permutation of n and sorts; the Epsil definition unranks directly.
  PermutationsAsCycles: {
    params: [[0], [1], [2], [3], [4], [5], [6]],
    count: ([n]) => factorial(n),
    unrank: ([n], r) => PermutationsAsCyclesFamily.unrank([n], r),
    rank: (x: number[][], [n]) => PermutationsAsCyclesFamily.rank(x, [n]) as number,
    valid: (x: number[][], [n]) => PermutationsAsCyclesFamily.valid(x, [n]),
    near: ([n]) =>
      Array.from({ length: factorial(n) }, (_, r) => PermutationsAsCyclesFamily.unrank([n], r) as number[][]).flatMap(
        (cycles) => [cycles, ...cycleNeighbours(cycles)],
      ),
  },
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
  // Restrictions of the symmetric group, in its lex order: read by filtering it.
  CyclicPermutations: lexRestriction([[0], [1], [2], [3], [4], [5]], (x, [n]) => n >= 1 && IsCyclicPermutationOf(x, n)),
  Involutions: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x, [n]) => IsInvolutionOf(x, n)),
  Derangements: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x, [n]) => IsDerangementOf(x, n)),
  AlternatingPermutations: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) =>
    x.every((v, i) => i === 0 || (i % 2 === 1 ? x[i - 1] < v : x[i - 1] > v)),
  ),
  ConnectedPermutations: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) =>
    x.every((_, j) => j === x.length - 1 || Math.max(...x.slice(0, j + 1)) !== j + 1),
  ),
  KDescentPermutations: lexRestriction(
    [
      [0, 0],
      [3, 0],
      [3, 1],
      [4, 1],
      [5, 2],
      [6, 3],
      [2, 3],
    ],
    (x, [, k]) => turns(x, (a, b) => a > b) === k,
  ),
  GrassmannianPermutations: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) => turns(x, (a, b) => a > b) <= 1),
  CograssmannianPermutations: lexRestriction(
    [[0], [1], [2], [3], [4], [5], [6]],
    (x) => turns(x, (a, b) => a < b) <= 1,
  ),
  KCyclePermutations: lexRestriction(
    [
      [0, 0],
      [3, 0],
      [3, 1],
      [4, 2],
      [5, 2],
      [5, 3],
      [6, 1],
      [6, 4],
      [2, 3],
    ],
    (x, [n, k]) => IsPermutationOf(x, n) && cycles(x) === k,
  ),
  ...Object.fromEntries(
    ["123", "132", "213", "231", "312", "321"].map((pattern) => [
      `PermutationsAvoiding${pattern}`,
      lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) => !contains(x, pattern)),
    ]),
  ),
  // Interpreted, a window table of either takes seconds per completion count past n = 4.
  NonCrossingCycleSupportPermutations: {
    ...lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) => !crossing(x)),
    interpretAt: process.env.DEEP_TESTS ? [5] : [4],
  },
  VexillaryPermutations: lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) => !contains4(x, "2143")),
  SeparablePermutations: {
    ...lexRestriction([[0], [1], [2], [3], [4], [5], [6]], (x) => !separates(x)),
    interpretAt: process.env.DEEP_TESTS ? [5] : [3],
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

const byHead = new Map(
  [
    ...epsilEntries,
    permutationsAsCycles,
    kCyclePermutations,
    alternatingPermutations,
    connectedPermutations,
    kDescentPermutations,
    ...permutationsAvoiding3,
    separablePermutations,
    nonCrossingCycleSupportPermutations,
    vexillaryPermutations,
    grassmannianPermutations,
    cograssmannianPermutations,
  ].map((family) => [family.head, family]),
);

for (const [head, reading] of Object.entries(READINGS)) {
  const family = byHead.get(head)!;
  const kernel = epsilKernelOn(ce, family);
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
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) => {
  const { tables } = family.epsil;
  const tabled = tables === undefined ? bindings : { ...bindings, _tables: evaluateEpsil(ce, tables, bindings) };
  return evaluateEpsil(ce, family.epsil[operation], tabled);
};

const list = (xs: unknown[]): unknown => ["List", ...xs.map((x) => (Array.isArray(x) ? list(x) : x))];

test("the interpreter agrees with compiled code", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = byHead.get(head)!;
    const p = reading.interpretAt ?? reading.params.at(-2)!;
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
  const kernel = epsilKernelOn(ce, byHead.get("SymmetricGroup")!);
  let total = 1n;
  for (let i = 2n; i <= 25n; i++) total *= i;
  expect(kernel.count([25])).toBe(total);
  const last = span(1, 25).toReversed();
  expect(kernel.unrank([25], total - 1n)).toEqual(last);
  expect(kernel.rank(last, [25])).toBe(total - 1n);
  const middle = kernel.unrank([25], total / 3n);
  expect(kernel.rank(middle, [25])).toBe(total / 3n);
});
