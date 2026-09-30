// Every compositions-area Epsil family against its independent TS reading: the same count, the
// same element at every rank, rank inverting unrank, and the same membership over every word near
// the family. Compiled and interpreted, and the interpreter checked directly against the
// definitions too.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn } from "../../collections/src/families/epsil.ts";
import {
  CompositionCount,
  CompositionFromMask,
  CompositionRank,
  IsCompositionOf,
} from "../../collections/src/families/kernels-combinatorics.ts";
import {
  CompositionsIntoKPartsCount,
  CompositionsIntoKPartsRank,
  CompositionsIntoKPartsUnrank,
  IsCompositionIntoKParts,
  IsWeakCompositionOf,
  WeakCompositionCount,
  WeakCompositionRank,
  WeakCompositionUnrank,
} from "../../collections/src/families/kernels-extra.ts";
import { epsilEntries } from "../src/families/core.ts";

const ce = new ComputeEngine();

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => unknown;
  readonly rank: (x: never, p: number[]) => number;
  readonly valid: (x: never, p: number[]) => boolean;
  readonly near: (p: number[]) => unknown[];
}

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}
const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const READINGS: Record<string, Reading> = {
  IntegerCompositions: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => CompositionCount(n),
    unrank: ([n], r) => CompositionFromMask(n, r),
    rank: (x: number[]) => CompositionRank(x),
    valid: (x: number[], [n]) => IsCompositionOf(x, n),
    // near misses: every word of length n over 0..n (a zero part or an out-of-range part), plus
    // words one shorter or longer over 1..n.
    near: ([n]) => [
      ...words(n, span(0, n)),
      ...(n > 0 ? words(n - 1, span(1, n)) : []),
      ...words(n + 1, span(1, n || 1)),
    ],
  },
  CompositionsIntoKParts: {
    params: [
      [0, 0],
      [1, 1],
      [3, 1],
      [3, 3],
      [5, 2],
      [5, 3],
      [6, 3],
    ],
    count: ([n, k]) => CompositionsIntoKPartsCount(n, k),
    unrank: ([n, k], r) => CompositionsIntoKPartsUnrank(n, k, r),
    rank: (x: number[]) => CompositionsIntoKPartsRank(x),
    valid: (x: number[], [n, k]) => IsCompositionIntoKParts(x, n, k),
    // near misses: every word of length k over 0..n (a zero or out-of-range part), plus words one
    // shorter or longer over 1..n.
    near: ([n, k]) => [
      ...words(k, span(0, n + 1)),
      ...(k > 0 ? words(k - 1, span(1, n + 1)) : []),
      ...words(k + 1, span(1, n + 1 || 1)),
    ],
  },
  WeakCompositions: {
    params: [
      [0, 0],
      [0, 2],
      [1, 1],
      [3, 1],
      [3, 3],
      [5, 2],
      [5, 3],
    ],
    count: ([n, k]) => WeakCompositionCount(n, k),
    unrank: ([n, k], r) => WeakCompositionUnrank(n, k, r),
    rank: (x: number[]) => WeakCompositionRank(x),
    valid: (x: number[], [n, k]) => IsWeakCompositionOf(x, n, k),
    // near misses: every word of length k over -1..n (a negative or out-of-range part), plus words
    // one shorter or longer over 0..n.
    near: ([n, k]) => [
      ...words(k, span(-1, n + 1)),
      ...(k > 0 ? words(k - 1, span(0, n + 1)) : []),
      ...words(k + 1, span(0, n + 1)),
    ],
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

test("past 2^53 IntegerCompositions answers in exact integers", () => {
  const kernel = kernelOn(ce, byHead.get("IntegerCompositions")!);
  const n = 60; // 2^59 compositions, well past 2^53
  let total = 1n;
  for (let i = 0; i < n - 1; i++) total *= 2n;
  expect(kernel.count([n])).toBe(total);
  const last = kernel.unrank([n], total - 1n);
  expect(last).toEqual(Array.from({ length: n }, () => 1));
  expect(kernel.rank(last, [n])).toBe(total - 1n);
  const middle = kernel.unrank([n], total / 3n);
  expect(kernel.rank(middle, [n])).toBe(total / 3n);
});
