import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyDefinition } from "../src/declare.ts";
import { SET_PARTITION_STATISTICS } from "../src/setpartition.ts";
import { bySignature } from "../src/types.ts";

const ce = new ComputeEngine();
const index = bySignature(SET_PARTITION_STATISTICS);

/** Every set partition of {1..n}, blocks in order of least element. */
function setPartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  const out: number[][][] = [];
  for (const rest of setPartitions(n - 1)) {
    for (let b = 0; b < rest.length; b++)
      out.push(rest.map((block, k) => (k === b ? [...block, n] : block)));
    out.push([...rest, [n]]);
  }
  return out;
}
// n <= 6: Bell(6) = 203, small enough to check every definition against the engine outright.
// n = 7 (Bell(7) = 877) is checked against the engine only by sample below — Crossings and
// Nestings walk every PAIR of arcs, so an exhaustive engine sweep at that size is minutes of
// wall time for what a closed-form JS reference answers instantly; see the invariant section.
const ALL = [0, 1, 2, 3, 4, 5, 6].flatMap(setPartitions);

const evaluate = (head: string, blocks: number[][]): number =>
  applyDefinition(
    ce,
    index.get(`${head}@SetPartition`)!,
    ce.box(["List", ...blocks.map((b) => ["List", ...b])] as never),
  ).re;

const sizes = (blocks: number[][]): number[] => blocks.map((b) => b.length);

/** The standard arc representation: within each block, consecutive pairs. */
const arcsOf = (blocks: number[][]): [number, number][] =>
  blocks.flatMap((b) => b.slice(0, -1).map((v, i): [number, number] => [v, b[i + 1]!]));

/** Arcs [p1,q1] and [p2,q2] relabelled a<b by left endpoint; c is the right endpoint of
 *  whichever starts at a, d the other's. Crossing is a<b<c<d, nesting a<b<d<c. */
function arcPairKind(
  [p1, q1]: [number, number],
  [p2, q2]: [number, number],
): "crossing" | "nesting" | "neither" {
  const aIsFirst = p1 < p2;
  const b = aIsFirst ? p2 : p1;
  const c = aIsFirst ? q1 : q2;
  const d = aIsFirst ? q2 : q1;
  if (b >= c) return "neither";
  return c < d ? "crossing" : "nesting";
}

const countArcPairs = (blocks: number[][], kind: "crossing" | "nesting"): number => {
  const arcs = arcsOf(blocks);
  let n = 0;
  for (let i = 0; i < arcs.length; i++)
    for (let j = i + 1; j < arcs.length; j++) if (arcPairKind(arcs[i]!, arcs[j]!) === kind) n++;
  return n;
};

const EXPECTED: Record<string, (b: number[][]) => number> = {
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

test("every set-partition definition has an independent reading", () => {
  for (const definition of SET_PARTITION_STATISTICS)
    expect(EXPECTED[definition.head], definition.head).toBeDefined();
});

for (const definition of SET_PARTITION_STATISTICS) {
  test(`${definition.head} agrees over every set partition of 1..6`, () => {
    const expected = EXPECTED[definition.head]!;
    for (const b of ALL) expect(evaluate(definition.head, b), JSON.stringify(b)).toBe(expected(b));
  });
}

// A sample of [7], rather than all Bell(7) = 877 of them, against the engine — the full sweep
// at this size costs minutes for Crossings/Nestings (see above) for the same answer the JS
// reference already gives instantly, and the invariant section below covers n = 7 exhaustively
// through that reference.
test("Crossings, Nestings and CrossingNestingTotal agree on a sample of set partitions of [7]", () => {
  const sample = setPartitions(7).filter((_, i) => i % 29 === 0); // ~30 of the 877
  for (const head of ["Crossings", "Nestings", "CrossingNestingTotal"]) {
    const expected = EXPECTED[head]!;
    for (const b of sample) expect(evaluate(head, b), JSON.stringify(b)).toBe(expected(b));
  }
});

// ── the classic invariant ─────────────────────────────────────────────────────────────────
//
// Crossings and nestings are equidistributed over set partitions of [n] (Kasraoui–Zeng), and
// the noncrossing partitions — like the nonnesting ones — are counted by the Catalan numbers.
// Checked against the JS reference (`countArcPairs`) rather than the engine: the reference is
// exercised against the engine's own answer, exhaustively, up to n = 6 and by sample at n = 7
// above, so it stands in here for what would otherwise be a 877-partition-by-877-partition
// engine sweep at n = 7 alone.

const CATALAN = [1, 1, 2, 5, 14, 42, 132, 429];

test("Crossings and nestings are equidistributed over set partitions of [n], n <= 7", () => {
  for (let n = 0; n <= 7; n++) {
    const parts = setPartitions(n);
    const crossings = parts.map((b) => countArcPairs(b, "crossing")).sort((a, c) => a - c);
    const nestings = parts.map((b) => countArcPairs(b, "nesting")).sort((a, c) => a - c);
    expect(crossings, `n=${n}`).toEqual(nestings);
  }
});

test("noncrossing and nonnesting set partitions of [n] are each counted by Catalan(n), n <= 7", () => {
  for (let n = 0; n <= 7; n++) {
    const parts = setPartitions(n);
    const noncrossing = parts.filter((b) => countArcPairs(b, "crossing") === 0).length;
    const nonnesting = parts.filter((b) => countArcPairs(b, "nesting") === 0).length;
    expect(noncrossing, `noncrossing n=${n}`).toBe(CATALAN[n]);
    expect(nonnesting, `nonnesting n=${n}`).toBe(CATALAN[n]);
  }
});
