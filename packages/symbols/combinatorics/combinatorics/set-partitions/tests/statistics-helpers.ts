// Shared universe, independent readings, and evaluation machinery for the sharded
// `setpartition-*.test.ts` files. Not itself a test file.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";
import { bySignature } from "../../src/statistics/types.ts";

export const ce = bareEngine();
export const index = bySignature(SET_PARTITION_STATISTICS);

/** Every set partition of {1..n}, blocks in order of least element. */
export function setPartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  const out: number[][][] = [];
  for (const rest of setPartitions(n - 1)) {
    for (let b = 0; b < rest.length; b++) out.push(rest.map((block, k) => (k === b ? [...block, n] : block)));
    out.push([...rest, [n]]);
  }
  return out;
}
// n <= 6: Bell(6) = 203, small enough to check every definition against the engine outright.
// n = 7 (Bell(7) = 877) is checked against the engine only by sample below — Crossings and
// Nestings walk every PAIR of arcs, so an exhaustive engine sweep at that size is minutes of
// wall time for what a closed-form JS reference answers instantly; see the invariant section.
export const ALL = [0, 1, 2, 3, 4, 5, 6].flatMap(setPartitions);

export const evaluate = (head: string, blocks: number[][]): number =>
  applyDefinition(
    ce,
    index.get(`${head}@SetPartition`)!,
    ce.box(["List", ...blocks.map((b) => ["List", ...b])] as never),
  ).re;

export const sizes = (blocks: number[][]): number[] => blocks.map((b) => b.length);

/** The standard arc representation: within each block, consecutive pairs. */
export const arcsOf = (blocks: number[][]): [number, number][] =>
  blocks.flatMap((b) => b.slice(0, -1).map((v, i): [number, number] => [v, b[i + 1]!]));

/** Arcs [p1,q1] and [p2,q2] relabelled a<b by left endpoint; c is the right endpoint of
 *  whichever starts at a, d the other's. Crossing is a<b<c<d, nesting a<b<d<c. */
function arcPairKind([p1, q1]: [number, number], [p2, q2]: [number, number]): "crossing" | "nesting" | "neither" {
  const aIsFirst = p1 < p2;
  const b = aIsFirst ? p2 : p1;
  const c = aIsFirst ? q1 : q2;
  const d = aIsFirst ? q2 : q1;
  if (b >= c) return "neither";
  return c < d ? "crossing" : "nesting";
}

export const countArcPairs = (blocks: number[][], kind: "crossing" | "nesting"): number => {
  const arcs = arcsOf(blocks);
  let n = 0;
  for (let i = 0; i < arcs.length; i++)
    for (let j = i + 1; j < arcs.length; j++) if (arcPairKind(arcs[i]!, arcs[j]!) === kind) n++;
  return n;
};

const total = (b: number[][]): number => sizes(b).reduce((a, c) => a + c, 0);
const choose2 = (s: number): number => (s < 2 ? 0 : (s * (s - 1)) / 2);
const sum = (xs: number[]): number => xs.reduce((a, c) => a + c, 0);
const successions = (b: number[][]): number =>
  sum(b.map((block) => block.slice(1).filter((v, i) => v - block[i]! === 1).length));
const antisingletons = (b: number[][]): number =>
  b.length === 0 ? 0 : successions(b) + (b[0]!.at(-1) === total(b) ? 1 : 0);
/** Opener of each element's block, for 1..n. */
const openers = (b: number[][]): number[] =>
  Array.from({ length: total(b) }, (_, k) => b.find((block) => block.includes(k + 1))![0]!);
const internalPoints = (b: number[][]): number => {
  const m = openers(b);
  return m.filter((v, e) => m.slice(0, e).some((u) => u > v) && m.slice(e + 1).some((u) => u > v)).length;
};
const terminalClosers = (b: number[][]): number => {
  const closers = b.map((block) => block.at(-1)!);
  const n = total(b);
  return closers.filter((c) => {
    for (let e = c + 1; e <= n; e++) if (!closers.includes(e)) return false;
    return true;
  }).length;
};

export const EXPECTED: Record<string, (b: number[][]) => number> = {
  Blocks: (b) => b.length,
  LargestBlock: (b) => (b.length === 0 ? 0 : Math.max(...sizes(b))),
  SmallestBlock: (b) => (b.length === 0 ? 0 : Math.min(...sizes(b))),
  BlockSizeSpan: (b) => (b.length === 0 ? 0 : Math.max(...sizes(b)) - Math.min(...sizes(b))),
  SingletonBlocks: (b) => sizes(b).filter((s) => s === 1).length,
  BlocksAtLeastTwo: (b) => sizes(b).filter((s) => s >= 2).length,
  BlocksSizeTwo: (b) => sizes(b).filter((s) => s === 2).length,
  LastBlockSize: (b) => (b.length === 0 ? 0 : b.at(-1)!.length),
  SetPartitionRank: (b) => total(b) - b.length,
  DimensionIndex: (b) => sum(b.map((k) => k.at(-1)! - k[0]! + 1)),
  SumOfBlockMinima: (b) => sum(b.map((k) => k[0]!)),
  SumOfBlockMaxima: (b) => sum(b.map((k) => k.at(-1)!)),
  Antisingletons: antisingletons,
  SingletonsAndAntisingletons: (b) => antisingletons(b) + sizes(b).filter((s) => s === 1).length,
  BlocksAndAntisingletons: (b) => (b.length === 0 ? 0 : antisingletons(b) + b.length),
  Successions: successions,
  MaximalBlockDifference: (b) => (b.length === 0 ? 0 : Math.max(...b.map((k) => k.at(-1)! - k[0]!))),
  FirstBlockCardinality: (b) => b[0]?.length ?? 0,
  LargestElementInFirstBlock: (b) => b[0]?.at(-1) ?? 0,
  InternalPoints: internalPoints,
  OverlappingBlockPairs: (b) =>
    b.flatMap((a, i) => b.slice(i + 1).filter((c) => c[0]! < a.at(-1)! && a.at(-1)! < c.at(-1)!)).length,
  SameBlockPairs: (b) => sum(sizes(b).map(choose2)),
  SameBlockTriples: (b) => sum(sizes(b).map((s) => (s * (s - 1) * (s - 2)) / 6)),
  DistinctBlockPairs: (b) => choose2(total(b)) - sum(sizes(b).map(choose2)),
  DimensionExponent: (b) => sum(b.map((k) => k.at(-1)! - k[0]! - (k.length - 1))),
  LargestOpener: (b) => (b.length === 0 ? 0 : Math.max(...b.map((k) => k[0]!))),
  SmallestCloser: (b) => (b.length === 0 ? 0 : Math.min(...b.map((k) => k.at(-1)!))),
  TerminalClosers: terminalClosers,
  BlocksWithOddMinimum: (b) => b.filter((k) => k[0]! % 2 === 1).length,
  BlocksWithEvenMinimum: (b) => b.filter((k) => k[0]! % 2 === 0).length,
  Crossings: (b) => countArcPairs(b, "crossing"),
  Nestings: (b) => countArcPairs(b, "nesting"),
  CrossingNestingTotal: (b) => countArcPairs(b, "crossing") + countArcPairs(b, "nesting"),
};

/** Generate `${head} agrees over every set partition of 1..6` for each of `heads`, against
 *  `EXPECTED`, over `ALL`. Called at module top level in each shard file — vitest collects
 *  `test()` calls made this way exactly as it would ones written inline. */
export function checkAgainstEngine(heads: readonly string[]): void {
  for (const head of heads) {
    test(`${head} agrees over every set partition of 1..6`, () => {
      const expected = EXPECTED[head];
      if (!expected) throw new Error(`no expected reading for ${head}`);
      for (const b of ALL) expect(evaluate(head, b), JSON.stringify(b)).toBe(expected(b));
    });
  }
}
