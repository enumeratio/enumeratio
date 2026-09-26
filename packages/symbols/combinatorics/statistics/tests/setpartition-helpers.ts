// Shared universe, independent readings, and evaluation machinery for the sharded
// `setpartition-*.test.ts` files. Not itself a test file.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../src/declare.ts";
import { SET_PARTITION_STATISTICS } from "../src/setpartition.ts";
import { bySignature } from "../src/types.ts";

export const ce = new ComputeEngine();
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
    index.get(`${head}@SetPartitions`)!,
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

export const EXPECTED: Record<string, (b: number[][]) => number> = {
  Blocks: (b) => b.length,
  LargestBlock: (b) => (b.length === 0 ? 0 : Math.max(...sizes(b))),
  SmallestBlock: (b) => (b.length === 0 ? 0 : Math.min(...sizes(b))),
  BlockSizeSpan: (b) => (b.length === 0 ? 0 : Math.max(...sizes(b)) - Math.min(...sizes(b))),
  SingletonBlocks: (b) => sizes(b).filter((s) => s === 1).length,
  BlocksAtLeastTwo: (b) => sizes(b).filter((s) => s >= 2).length,
  BlocksSizeTwo: (b) => sizes(b).filter((s) => s === 2).length,
  LastBlockSize: (b) => (b.length === 0 ? 0 : b.at(-1)!.length),
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
