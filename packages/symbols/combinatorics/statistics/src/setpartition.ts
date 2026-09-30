// Set-partition statistics, over `_x` = the list of blocks, each block a list of elements.
//
// Almost everything here is a statement about the BLOCK SIZES, read over the blocks themselves.
// Crossings and nestings are not: they read the standard ARC REPRESENTATION instead — within
// each block (already ascending), link consecutive elements — and compare arcs pairwise. See
// `ArcRepresentation` in @enumeratio/combinatorics for the same construction as a typed map.

import type { Definition, MathJSON } from "./types.ts";
import { add, and, at, atLeastValue, count, equals, less, nonEmpty, or, subtract, sumOver } from "./vocabulary.ts";

const on = "SetPartition";
const stat = (head: string, summary: string, expr: Definition["expr"], note?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
});

/** The size of each block. Read over the blocks themselves rather than by position, so the
 *  compiler can see each one is a list. */
const sizes: MathJSON = ["Map", ["Function", ["Length", "b"], "b"], "_x"];
/** How many blocks' sizes satisfy `predicate`. */
const blocksWhere = (predicate: (size: MathJSON) => MathJSON): MathJSON => [
  "Count",
  ["Filter", "_x", ["Function", predicate(["Length", "b"]), "b"]],
];

// ── the standard arc representation ──────────────────────────────────────────────────────
//
// Within one block (already ascending), link consecutive elements. The arcs are kept as two
// parallel lists of integers, their left ends and their right ends: a block's left ends are all
// but its last element, its right ends all but its first. Plain integer lists index cheaply,
// compiled or not, where a list of pairs would need its type proved at every `At`.

const lefts: MathJSON = ["Flatten", ["Map", ["Function", ["Most", "b"], "b"], "_x"]];
const rights: MathJSON = ["Flatten", ["Map", ["Function", ["Rest", "b"], "b"], "_x"]];
const arcCount: MathJSON = ["Length", lefts];

/** [isCrossing, isNesting] for arc i against arc j, computed together so the shared terms —
 *  which arc starts first, and its partner's endpoints — are each stated once. Relabel the two
 *  arcs a < b by left endpoint (distinct: a position starts at most one arc); c is the right
 *  endpoint of whichever starts at a, d the other's. Crossing is then exactly a < b < c < d and
 *  nesting a < b < d < c — Kasraoui–Zeng's definitions, read off without knowing beforehand
 *  which arc is which. */
const pairFlags = (i: MathJSON, j: MathJSON): MathJSON => {
  const p1 = at(i, lefts);
  const q1 = at(i, rights);
  const p2 = at(j, lefts);
  const q2 = at(j, rights);
  const iStartsFirst = less(p1, p2);
  const laterLeft: MathJSON = ["Max", p1, p2];
  const c: MathJSON = ["If", iStartsFirst, q1, q2];
  const d: MathJSON = ["If", iStartsFirst, q2, q1];
  const overlap = less(laterLeft, c);
  return ["List", and(overlap, less(c, d)), and(overlap, less(d, c))];
};
const isCrossing = (i: MathJSON, j: MathJSON): MathJSON => at(1, pairFlags(i, j));
const isNesting = (i: MathJSON, j: MathJSON): MathJSON => at(2, pairFlags(i, j));

/** Guard for a definition that reads a PAIR of arcs — needs at least two. */
const hasArcPair = (body: MathJSON): MathJSON => ["If", less(arcCount, 2), 0, body];
const laterArcs: MathJSON = ["Range", add("i", 1), arcCount, 1];
const allArcs: MathJSON = ["Range", 1, arcCount, 1];

const crossings: MathJSON = hasArcPair(sumOver(allArcs, count(laterArcs, isCrossing("i", "j"), "j"), "i"));
const nestings: MathJSON = hasArcPair(sumOver(allArcs, count(laterArcs, isNesting("i", "j"), "j"), "i"));
// Crossing and nesting are mutually exclusive per pair, so the total is how many pairs are
// either.
const crossingsAndNestings: MathJSON = hasArcPair(
  sumOver(allArcs, count(laterArcs, or(isCrossing("i", "j"), isNesting("i", "j")), "j"), "i"),
);

export const SET_PARTITION_STATISTICS: readonly Definition[] = [
  stat("Blocks", "The number of blocks.", ["Length", "_x"]),
  stat("LargestBlock", "The size of the largest block.", nonEmpty(["Max", sizes])),
  stat("SmallestBlock", "The size of the smallest block.", nonEmpty(["Min", sizes])),
  stat("BlockSizeSpan", "Largest block size minus smallest.", nonEmpty(subtract(["Max", sizes], ["Min", sizes]))),
  stat(
    "SingletonBlocks",
    "Blocks containing exactly one element.",
    blocksWhere((size) => equals(size, 1)),
  ),
  stat(
    "BlocksAtLeastTwo",
    "Blocks containing at least two elements.",
    blocksWhere((size) => atLeastValue(size, 2)),
  ),
  stat(
    "BlocksSizeTwo",
    "Blocks containing exactly two elements.",
    blocksWhere((size) => equals(size, 2)),
  ),
  stat("LastBlockSize", "The size of the final block.", nonEmpty(["Last", sizes])),
  stat(
    "Crossings",
    "Pairs of arcs a < b < c < d with a~c and b~d.",
    crossings,
    "Read off the standard arc representation: within each block, consecutive elements are linked, and a crossing is two arcs whose spans interleave rather than nest or sit apart.",
  ),
  stat(
    "Nestings",
    "Pairs of arcs a < b < c < d with a~d and b~c.",
    nestings,
    "The complementary case to Crossings: one arc's span strictly contains the other's. Equidistributed with Crossings over set partitions of [n] (Kasraoui–Zeng), and the noncrossing and nonnesting partitions are each counted by the Catalan numbers.",
  ),
  stat("CrossingNestingTotal", "Crossings plus nestings.", crossingsAndNestings),
];
