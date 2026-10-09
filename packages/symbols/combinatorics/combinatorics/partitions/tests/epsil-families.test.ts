// PartitionsInBox, the one partitions-area family moved to Epsil (BL-30, following #491's pilot
// and #507's compositions move): against its independent TS reading (kernels-extra.ts), the same
// count, the same element at every rank, rank inverting unrank, and the same membership over
// every near-miss word. Compiled and interpreted, and the interpreter checked directly against
// the definitions too.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, epsilKernelOn } from "../../collections/src/families/epsil.ts";
import {
  IsPartitionInBox,
  PartitionsInBoxCount,
  PartitionsInBoxRank,
  PartitionsInBoxUnrank,
} from "../../collections/src/families/kernels-extra.ts";
import { entries as listed, epsilEntries } from "../src/families/core.ts";
import { entries as restricted } from "../src/families/partitions.ts";

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

const READINGS: Record<string, Reading> = {
  PartitionsInBox: {
    params: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
      [2, 4],
      [4, 2],
    ],
    count: ([a, b]) => PartitionsInBoxCount(a, b),
    unrank: ([a, b], r) => PartitionsInBoxUnrank(a, b, r),
    rank: (x: number[], [a, b]) => PartitionsInBoxRank(x, a, b),
    valid: (x: number[], [a, b]) => IsPartitionInBox(x, a, b),
    // near misses: every word of length a over 0..b+1 (a zero or over-cap part, or breaking
    // weakly-decreasing order), plus words one shorter or longer over 1..b.
    near: ([a, b]) => [
      ...words(a, span(0, b + 1)),
      ...(a > 0 ? words(a - 1, span(1, b || 1)) : []),
      ...words(a + 1, span(1, b || 1)),
    ],
  },
};

// The restrictions of IntegerPartitions: read by filtering every partition of n, largest part
// first, and the candidates for membership are every partition of n, each of them reversed (an
// order the family rejects) and a step from each member.
const memo = <V>(make: (p: number[]) => V): ((p: number[]) => V) => {
  const seen = new Map<string, V>();
  return (p) => {
    const key = p.join();
    if (!seen.has(key)) seen.set(key, make(p));
    return seen.get(key)!;
  };
};

/** Every partition of n with parts at most `cap`, largest part first. */
function partitionsOf(n: number, cap = n): number[][] {
  if (n === 0) return [[]];
  return span(1, Math.min(n, cap))
    .toReversed()
    .flatMap((first) => partitionsOf(n - first, first).map((rest) => [first, ...rest]));
}

/** Partitions a step from `member`: a part moved either way, one dropped or added, swapped, reversed. */
function neighbours(member: number[]): number[][] {
  const moved = member.flatMap((_, i) => [1, -1].map((d) => member.map((v, j) => (i === j ? v + d : v))));
  const swapped = member.length > 1 ? [[member[1], member[0], ...member.slice(2)]] : [];
  return [...moved, ...swapped, member.slice(0, -1), [...member, 1], member.toReversed()];
}

function restriction(params: number[][], member: (x: number[], p: number[]) => boolean): Reading {
  const members = memo((p) => partitionsOf(p[0]).filter((x) => member(x, p)));
  const keys = memo((p) => new Set(members(p).map((x) => x.join())));
  return {
    params,
    count: (p) => members(p).length,
    unrank: (p, r) => members(p)[r],
    rank: (x: number[], p) => members(p).findIndex((m) => m.join() === x.join()),
    valid: (x: number[], p) => keys(p).has(x.join()),
    near: (p) => [...partitionsOf(p[0]).flatMap((x) => [x, x.toReversed()]), ...members(p).flatMap(neighbours)],
  };
}

const DEEP = process.env.DEEP_TESTS === "1";
const sizes = (to: number): number[][] => Array.from({ length: to + 1 }, (_, n) => [n]);
const upTo = DEEP ? 12 : 8;
const isPrime = (s: number): boolean => s >= 2 && span(2, s - 1).every((d) => s % d !== 0);
const pairs: number[][] = [
  [0, 0],
  [0, 2],
  [1, 1],
  [3, 0],
  [4, 2],
  [5, 2],
  [6, 3],
  [6, 9],
  [7, 3],
  ...(DEEP
    ? [
        [10, 4],
        [9, 3],
      ]
    : []),
];
const RESTRICTIONS: Record<string, Reading> = {
  IntegerPartitions: restriction(sizes(upTo), () => true),
  PartitionsIntoKParts: restriction(pairs, (x, [, k]) => x.length === k),
  DistinctPartitions: restriction(sizes(upTo), (x) => x.every((v, i) => i === 0 || x[i - 1] > v)),
  PartitionsMaxPart: restriction(pairs, (x, [, m]) => x.every((v) => v <= m)),
  LargestPartPartitions: restriction(pairs, (x, [, m]) => (m === 0 ? x.length === 0 : x[0] === m)),
  OddPartitions: restriction(sizes(upTo), (x) => x.every((v) => v % 2 === 1)),
  PrimePartitions: restriction(sizes(upTo), (x) => x.every(isPrime)),
  SquarePartitions: restriction(sizes(upTo), (x) => x.every((v) => [1, 4, 9, 16].includes(v))),
  TriangularPartitions: restriction(sizes(upTo), (x) => x.every((v) => [1, 3, 6, 10].includes(v))),
};

const byHead = new Map([...listed, ...epsilEntries, ...restricted].map((family) => [family.head, family]));

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

test("past 2^53 PartitionsInBox answers in exact integers", () => {
  const kernel = epsilKernelOn(ce, byHead.get("PartitionsInBox")!);
  // Binomial(a+b, a) with a = b = 30 is ~59132290782430712, well past 2^53.
  const a = 30,
    b = 30;
  const total = kernel.count([a, b]) as bigint;
  expect(total).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  // rank 0 is the full box (every N-step first -> every part = b); rank total-1 is the empty
  // partition (every N-step last -> every part filtered to 0).
  const first = kernel.unrank([a, b], 0n);
  expect(first).toEqual(Array.from({ length: a }, () => b));
  expect(kernel.rank(first, [a, b])).toBe(0n);
  const last = kernel.unrank([a, b], total - 1n);
  expect(last).toEqual([]);
  expect(kernel.rank(last, [a, b])).toBe(total - 1n);
  const middle = kernel.unrank([a, b], total / 3n);
  expect(kernel.rank(middle, [a, b])).toBe(total / 3n);
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

// Past 2^53 the table is out of the interpreter's reach (minutes of exact integers by n = 300),
// so every operation declines, unknown, as the TS kernels did.
test("past 2^53 IntegerPartitions declines", () => {
  const kernel = epsilKernelOn(ce, byHead.get("IntegerPartitions")!);
  expect(() => kernel.count([400])).toThrow(/past 2\^53/);
  expect(() => kernel.unrank([400], 0n)).toThrow(/past 2\^53/);
});
