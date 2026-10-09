// Every compositions-area Epsil family against its independent TS reading: the same count, the
// same element at every rank, rank inverting unrank, and the same membership over every word near
// the family. Compiled and interpreted, and the interpreter checked directly against the
// definitions too.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { CompositionCount, IsCompositionOf } from "../../collections/src/families/kernels-combinatorics.ts";
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
import { entries as restricted } from "../src/families/compositions.ts";
import { epsilEntries } from "../src/families/core.ts";

const ce = bareEngine();

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

/** Every composition of n, lex on the parts. */
function lexCompositions(n: number): number[][] {
  if (n === 0) return [[]];
  return Array.from({ length: n }, (_, i) => i + 1).flatMap((first) =>
    first === n ? [[n]] : lexCompositions(n - first).map((rest) => [first, ...rest]),
  );
}

const READINGS: Record<string, Reading> = {
  IntegerCompositions: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => CompositionCount(n),
    unrank: ([n], r) => lexCompositions(n)[r],
    rank: (x: number[], [n]) => lexCompositions(n).findIndex((c) => c.join() === x.join()),
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

// The restrictions of IntegerCompositions: read by filtering every composition of n, lex on the
// parts, and the candidates for membership are every composition of n (the ones the restriction
// rejects among them) and a step from each member.
const memo = <V>(make: (p: number[]) => V): ((p: number[]) => V) => {
  const seen = new Map<string, V>();
  return (p) => {
    const key = p.join();
    if (!seen.has(key)) seen.set(key, make(p));
    return seen.get(key)!;
  };
};

/** Compositions a step from `member`: a part moved either way, one dropped or added, swapped, reversed. */
function neighbours(member: number[]): number[][] {
  const moved = member.flatMap((_, i) => [1, -1].map((d) => member.map((v, j) => (i === j ? v + d : v))));
  const swapped = member.length > 1 ? [[member[1], member[0], ...member.slice(2)]] : [];
  return [...moved, ...swapped, member.slice(0, -1), [...member, 1], member.toReversed()];
}

function restriction(params: number[][], member: (x: number[], p: number[]) => boolean): Reading {
  const members = memo((p) => lexCompositions(p[0]).filter((x) => member(x, p)));
  const keys = memo((p) => new Set(members(p).map((x) => x.join())));
  return {
    params,
    count: (p) => members(p).length,
    unrank: (p, r) => members(p)[r],
    rank: (x: number[], p) => members(p).findIndex((m) => m.join() === x.join()),
    valid: (x: number[], p) => keys(p).has(x.join()),
    near: (p) => [...lexCompositions(p[0]), ...members(p).flatMap(neighbours)],
  };
}

const sizes = (to: number): number[][] => Array.from({ length: to + 1 }, (_, n) => [n]);
const pairs = (...ps: number[][]): number[][] => ps;
const isPrime = (s: number): boolean =>
  s >= 2 && Array.from({ length: s - 2 }, (_, i) => i + 2).every((d) => s % d !== 0);
const parts = (x: number[], allowed: (s: number) => boolean): boolean => x.every(allowed);

const DEEP = process.env.DEEP_TESTS === "1";
const upTo = DEEP ? 10 : 7;
const RESTRICTIONS: Record<string, Reading> = {
  OddCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => s % 2 === 1)),
  ProperCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => s >= 2)),
  DyadicCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => (s & (s - 1)) === 0)),
  FibonacciCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => s <= 2)),
  TriCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => s <= 3)),
  TetraCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => s <= 4)),
  TriangularCompositions: restriction(sizes(upTo), (x) => parts(x, (s) => [1, 3, 6, 10].includes(s))),
  PrimeCompositions: restriction(sizes(upTo), (x) => parts(x, isPrime)),
  PartSizeBoundedCompositions: restriction(
    pairs([0, 0], [3, 0], [3, 1], [4, 2], [5, 3], [6, 2], [5, 9], [7, 4]),
    (x, [, k]) => parts(x, (s) => s <= k),
  ),
  PartCountBoundedCompositions: restriction(
    pairs([0, 0], [3, 0], [3, 1], [4, 2], [5, 3], [6, 2], [5, 9], [7, 4]),
    (x, [, k]) => x.length <= k,
  ),
  CarlitzCompositions: restriction(sizes(upTo), (x) => x.every((v, i) => i === 0 || x[i - 1] !== v)),
  PalindromicCompositions: restriction(sizes(upTo), (x) => x.every((v, i) => v === x[x.length - 1 - i])),
  ZigzagCompositions: restriction(sizes(upTo), (x) => {
    const steps = x.slice(1).map((v, i) => Math.sign(v - x[i]));
    return steps.every((d, i) => d !== 0 && (i === 0 || d === -steps[i - 1]));
  }),
};

const byHead = new Map([...epsilEntries, ...restricted].map((family) => [family.head, family]));

for (const [head, reading] of Object.entries({ ...READINGS, ...RESTRICTIONS })) {
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
  const kernel = epsilKernelOn(ce, byHead.get("IntegerCompositions")!);
  const n = 60; // 2^59 compositions, well past 2^53
  let total = 1n;
  for (let i = 0; i < n - 1; i++) total *= 2n;
  expect(kernel.count([n])).toBe(total);
  expect(kernel.unrank([n], 0n)).toEqual(Array.from({ length: n }, () => 1));
  const last = kernel.unrank([n], total - 1n);
  expect(last).toEqual([n]);
  expect(kernel.rank(last, [n])).toBe(total - 1n);
  const middle = kernel.unrank([n], total / 3n);
  expect(kernel.rank(middle, [n])).toBe(total / 3n);
});

// The restrictions through the interpreter alone, at the smallest params with a couple of members.
for (const [head, reading] of Object.entries(RESTRICTIONS)) {
  test(`${head}: the interpreter agrees with compiled code`, () => {
    const family = byHead.get(head)!;
    const p = reading.params.filter((q) => reading.count(q) >= 2).at(DEEP ? -2 : 0)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of new Set([0, Math.floor(total / 2), total - 1])) {
      const element = reading.unrank(p, r);
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(list(element as unknown[]));
      expect(interpreted(family, "rank", { ...bind, _x: list(element as unknown[]) })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: list(element as unknown[]) })).toBe("True");
    }
  });
}

// Past 2^53 these tables are out of the interpreter's reach, so every operation declines (unknown).
for (const [head, p] of [
  ["CarlitzCompositions", [120]],
  ["ZigzagCompositions", [100]],
  ["PartCountBoundedCompositions", [120, 120]],
] as const) {
  test(`past 2^53 ${head} declines`, () => {
    const kernel = epsilKernelOn(ce, byHead.get(head)!);
    expect(() => kernel.count([...p])).toThrow(/past 2\^53/);
    expect(() => kernel.unrank([...p], 0n)).toThrow(/past 2\^53/);
  });
}
