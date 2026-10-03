// The set-partition families defined in Epsil (BL-30's DP phase): against their independent TS
// readings, the same count, the same element at every rank, rank inverting unrank, and the same
// membership over every near miss. Compiled and interpreted, and the interpreter checked
// directly against the definitions too.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, elementJson, kernelOn } from "../../collections/src/families/epsil.ts";
import {
  BellB,
  BlocksToLabels,
  BlocksToRgs,
  Fubini,
  IsSetPartitionOf,
  LabelsToOrderedBlocks,
  SetCompositionRank,
  SetCompositionUnrank,
  RgsRank,
  RgsToBlocks,
  RgsUnrank,
  SetPartitionsIntoKBlocksRank,
  SetPartitionsIntoKBlocksUnrank,
  StirlingS2,
} from "../../collections/src/families/kernels-combinatorics.ts";
import {
  IsPerfectMatchingOf,
  IsSurjectionOf,
  PerfectMatchingCount,
  PerfectMatchingRank,
  PerfectMatchingUnrank,
  SurjectionCount,
  SurjectionRank,
  SurjectionUnrank,
} from "../../collections/src/families/kernels-extra.ts";
import { entries, surjectionsEntries } from "../src/families/core.ts";
import { entries as matchingEntries, readings as matchingReadings } from "../src/families/matchings.ts";
import { entries as wordEntries, isRestrictedGrowthStringOf } from "../src/families/paths-partitions.ts";

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

/**
 * Blocks near a partition of 1..n: every labelling of 1..n by 0..n, as blocks in label order
 * (empty blocks where a label is skipped, and in any order of least elements), each also with
 * an element lost, one past n added, and one repeated.
 */
function nearBlocks(n: number): number[][][] {
  const out: number[][][] = [];
  for (const labels of words(n, span(0, n))) {
    const blocks = Array.from({ length: Math.max(-1, ...labels) + 1 }, (_, b) =>
      span(1, n).filter((x) => labels[x - 1] === b),
    );
    out.push(blocks);
    if (blocks.length > 0) {
      out.push([...blocks.slice(0, -1), blocks.at(-1)!.slice(1)]);
      out.push([...blocks.slice(0, -1), [...blocks.at(-1)!, n + 1]]);
      out.push([...blocks.slice(0, -1), [...blocks.at(-1)!, 1]]);
    }
  }
  return out;
}

const READINGS: Record<string, Reading> = {
  SetPartitions: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsToBlocks(RgsUnrank(n, r)),
    rank: (x: number[][], [n]) => RgsRank(BlocksToRgs(x, n)),
    valid: (x: number[][], [n]) => IsSetPartitionOf(x, n),
    near: ([n]) => nearBlocks(Math.min(n, 4)),
  },
  SetPartitionsIntoKBlocks: {
    params: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 2],
      [4, 2],
      [4, 4],
      [5, 3],
      [6, 3],
    ],
    count: ([n, k]) => StirlingS2(n, k),
    unrank: ([n, k], r) => RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r)),
    rank: (x: number[][], [n, k]) => SetPartitionsIntoKBlocksRank(BlocksToRgs(x, n), k),
    valid: (x: number[][], [n, k]) => IsSetPartitionOf(x, n, k),
    near: ([n]) => nearBlocks(Math.min(n, 4)),
  },
  Surjections: {
    params: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 2],
      [4, 2],
      [4, 3],
      [5, 3],
      [6, 3],
    ],
    count: ([n, k]) => SurjectionCount(n, k),
    unrank: ([n, k], r) => SurjectionUnrank(n, k, r),
    rank: (x: number[], [, k]) => SurjectionRank(x, k),
    valid: (x: number[], [n, k]) => IsSurjectionOf(x, n, k),
    // every word over 0..k+1 (a letter out of range, or one missed), and one letter short or over.
    near: ([n, k]) => [
      ...words(n, span(0, k + 1)),
      ...(n > 0 ? words(n - 1, span(1, k || 1)) : []),
      ...words(n + 1, span(1, k || 1)),
    ],
  },
  SetCompositions: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => Fubini(n),
    unrank: ([n], r) => LabelsToOrderedBlocks(SetCompositionUnrank(n, r)),
    rank: (x: number[][], [n]) => SetCompositionRank(BlocksToLabels(x), n),
    valid: (x: number[][], [n]) => IsSetPartitionOf(x, n),
    near: ([n]) => nearBlocks(Math.min(n, 4)),
  },
  PerfectMatchings: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => PerfectMatchingCount(n),
    unrank: ([n], r) => PerfectMatchingUnrank(n, r),
    rank: (x: number[][], [n]) => PerfectMatchingRank(x, n),
    valid: (x: number[][], [n]) => IsPerfectMatchingOf(x, n),
    near: ([n]) => nearPairs(n),
  },
  RestrictedGrowthStrings: {
    params: [[0], [1], [2], [3], [4], [5], [6]],
    count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsUnrank(n, r),
    rank: (x: number[]) => RgsRank(x),
    valid: (x: number[], [n]) => isRestrictedGrowthStringOf(x, n),
    // every word over 0..n, and one letter short or over.
    near: ([n]) => [
      ...words(n, span(0, n)),
      ...(n > 0 ? words(n - 1, span(0, n - 1)) : []),
      ...words(n + 1, span(0, n)),
    ],
  },
  ...Object.fromEntries(
    matchingReadings.map((reading): [string, Reading] => [
      reading.head,
      {
        params: [[0], [1], [2], [3], [4], [5], [6]].filter(([n]) => n <= 5 || reading.head.endsWith("Partitions")),
        count: (p) => reading.count(p),
        unrank: (p, r) => reading.unrank(p, r),
        rank: (x, p) => reading.rank(x as never, p) as number,
        valid: (x, p) => reading.valid(x as never, p),
        // a set partition or perfect matching of 1..n or 1..2n, each of which the family may exclude
        near: ([n]) => (reading.head.endsWith("Partitions") ? nearBlocks(Math.min(n, 4)) : nearPairs(n)),
      },
    ]),
  ),
};

/**
 * Pairs near a perfect matching of 1..2n, each pair written ascending: every matching of 1..2n
 * (the crossing and nesting ones among them), and from each one a point changed, a pair lost or
 * repeated, and the pairs in another order.
 */
function nearPairs(n: number): number[][][] {
  const out: number[][][] = [];
  const total = PerfectMatchingCount(n);
  const sorted = (a: number, b: number): number[] => (a < b ? [a, b] : [b, a]);
  for (let r = 0; r < Math.min(total, 105); r++) {
    const pairs = PerfectMatchingUnrank(n, r);
    out.push(pairs, pairs.toReversed());
    if (n === 0) continue;
    out.push(pairs.slice(1), [...pairs, pairs[0]]);
    for (let i = 0; i < n; i++)
      for (const point of [0, 1, 2 * n, 2 * n + 1, pairs[i][0]])
        out.push(pairs.map((pair, j) => (j === i ? sorted(point, pair[1]) : pair)));
  }
  return out;
}

const byHead = new Map(
  [...surjectionsEntries, ...entries, ...wordEntries, ...matchingEntries]
    .filter((f) => "epsil" in f)
    .map((f) => [f.head, f as EpsilFamily]),
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
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, reading.valid(candidate as never, p)]);
    });
  }
}

test("a set partition's blocks rank in any order", () => {
  const kernel = kernelOn(ce, byHead.get("SetPartitions")!);
  const rank = kernel.rank([[1, 4], [2], [3, 5]], [5]);
  expect(kernel.rank([[5, 3], [4, 1], [2]], [5])).toBe(rank);
  expect(rank).toBe(BigInt(RgsRank([0, 1, 2, 0, 2])));
});

test("a matching ranks with its pairs in any order and either way round", () => {
  const kernel = kernelOn(ce, byHead.get("PerfectMatchings")!);
  expect(
    kernel.rank(
      [
        [3, 1],
        [6, 2],
        [5, 4],
      ],
      [3],
    ),
  ).toBe(
    kernel.rank(
      [
        [1, 3],
        [2, 6],
        [4, 5],
      ],
      [3],
    ),
  );
});

test("a crossing or nesting pair is refused whichever way round it is written", () => {
  expect(
    kernelOn(ce, byHead.get("NonCrossingMatchings")!).valid(
      [
        [3, 1],
        [2, 4],
      ],
      [2],
    ),
  ).toBe(false);
  expect(
    kernelOn(ce, byHead.get("NonNestingMatchings")!).valid(
      [
        [4, 1],
        [2, 3],
      ],
      [2],
    ),
  ).toBe(false);
});

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
      const element = elementJson(reading.unrank(p, r));
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(element);
      expect(interpreted(family, "rank", { ...bind, _x: element })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: element })).toBe("True");
    }
  }
});

test("past 2^53 SetPartitionsIntoKBlocks answers in exact integers", () => {
  const kernel = kernelOn(ce, byHead.get("SetPartitionsIntoKBlocks")!);
  const n = 36;
  const k = 3;
  // S(n, 3) = (3^n − 3·2^n + 3) / 6
  const total = kernel.count([n, k]) as bigint;
  expect(total).toBe((3n ** 36n - 3n * 2n ** 36n + 3n) / 6n);
  expect(total).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  // Rank 0 puts all but the last two in the first block; the last rank is 1, 2, 3, 3, …
  expect(kernel.unrank([n, k], 0n)).toEqual([span(1, n - 2), [n - 1], [n]]);
  const last = kernel.unrank([n, k], total - 1n);
  expect(last).toEqual([[1], [2], span(3, n)]);
  expect(kernel.rank(last, [n, k])).toBe(total - 1n);
  const middle = kernel.unrank([n, k], total / 3n);
  expect(kernel.rank(middle, [n, k])).toBe(total / 3n);
});
