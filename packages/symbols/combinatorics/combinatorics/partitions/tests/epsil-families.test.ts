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

const byHead = new Map(epsilEntries.map((family) => [family.head, family]));

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
