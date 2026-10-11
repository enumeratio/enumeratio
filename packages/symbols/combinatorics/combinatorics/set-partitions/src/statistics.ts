// Set-partition statistics, over `_x` = the list of blocks, each block a list of elements.
//
// Almost everything here is a statement about the BLOCK SIZES, read over the blocks themselves.
// Crossings and nestings are not: they read the standard ARC REPRESENTATION instead — within
// each block (already ascending), link consecutive elements — and compare arcs pairwise. See
// `ArcRepresentation` in @enumeratio/combinatorics for the same construction as a typed map.

import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import {
  add,
  and,
  at,
  atLeastValue,
  count,
  equals,
  forEach,
  greater,
  less,
  max,
  nonEmpty,
  or,
  subtract,
  sumOver,
} from "../../src/statistics/vocabulary.ts";

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

// ── block extremes and cyclic adjacency ──────────────────────────────────────────────────
//
// Blocks are ascending and ordered by least element, so a block's first and last entries are its
// minimum and maximum (its "opener" and "closer"), and `At(_x, 1)` is the block holding 1.

const firsts: MathJSON = ["Map", ["Function", ["At", "b", 1], "b"], "_x"];
const lasts: MathJSON = ["Map", ["Function", ["Last", "b"], "b"], "_x"];
/** The ground set's size n. */
const groundSize: MathJSON = ["Sum", sizes];
const sumOverBlocks = (term: (block: MathJSON) => MathJSON): MathJSON =>
  nonEmpty(["Sum", ["Map", ["Function", term("b"), "b"], "_x"]]);
const blockSpan = (b: MathJSON): MathJSON => subtract(["Last", b], ["At", b, 1]);

/** Guard for a definition that reads arcs — needs at least one. */
const hasArc = (body: MathJSON): MathJSON => ["If", less(arcCount, 1), 0, body];
/** i and i+1 in one block: an arc of length 1. */
const successions: MathJSON = hasArc(count(allArcs, equals(subtract(at("i", rights), at("i", lefts)), 1)));
/** i and i+1 in one block, cyclically: also n with 1, i.e. the block holding 1 reaches n. */
const antisingletons: MathJSON = nonEmpty(add(successions, ["If", equals(["Last", at(1)], groundSize), 1, 0]));
/** n choose 2 and n choose 3. */
const pairsIn = (n: MathJSON): MathJSON => ["Divide", ["Multiply", n, subtract(n, 1)], 2];
const triplesIn = (n: MathJSON): MathJSON => ["Divide", ["Multiply", n, subtract(n, 1), subtract(n, 2)], 6];
const singletonBlocks: MathJSON = blocksWhere((size) => equals(size, 1));

/** Element e's block opener, for e = 1 .. n. */
const openerOfEach: MathJSON = [
  "Map",
  ["Function", ["At", ["At", ["Filter", "_x", ["Function", ["Contains", "b", "e"], "b"]], 1], 1], "e"],
  ["Range", 1, groundSize],
];
/** Elements e with an earlier and a later element whose blocks open after e's block does. */
const internalPoints: MathJSON = [
  "If",
  less(groundSize, 3),
  0,
  count(
    ["Range", 2, subtract(groundSize, 1)],
    and(
      greater(max(forEach(["Range", 1, subtract("e", 1)], at("j", openerOfEach), "j")), at("e", openerOfEach)),
      greater(max(forEach(["Range", add("e", 1), groundSize], at("j", openerOfEach), "j")), at("e", openerOfEach)),
    ),
    "e",
  ),
];

const closerCountAbove = (closer: MathJSON): MathJSON => [
  "Count",
  ["Filter", lasts, ["Function", greater("c", closer), "c"]],
];
/** Closers e with every larger element a closer: exactly n - e closers lie above e. */
const terminalClosers: MathJSON = nonEmpty([
  "Count",
  ["Filter", lasts, ["Function", equals(closerCountAbove("e"), subtract(max(lasts), "e")), "e"]],
]);

/** Pairs of blocks A, B (A opening first) with min B < max A < max B. */
const overlappingBlockPairs: MathJSON = [
  "If",
  less(["Length", "_x"], 2),
  0,
  sumOver(
    ["Range", 1, ["Length", "_x"]],
    count(
      ["Range", add("i", 1), ["Length", "_x"], 1],
      and(less(at("j", firsts), at("i", lasts)), less(at("i", lasts), at("j", lasts))),
      "j",
    ),
    "i",
  ),
];

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
  // FindStat statistics, named by their descriptions; each is checked against FindStat's own values.
  stat(
    "SetPartitionRank",
    "The number of elements minus the number of blocks.",
    nonEmpty(subtract(groundSize, ["Length", "_x"])),
  ),
  stat(
    "DimensionIndex",
    "The sum over blocks of largest minus smallest element, plus one.",
    sumOverBlocks((b) => add(blockSpan(b), 1)),
  ),
  stat(
    "SumOfBlockMinima",
    "The sum of the smallest elements of the blocks.",
    sumOverBlocks((b) => ["At", b, 1]),
  ),
  stat(
    "SumOfBlockMaxima",
    "The sum of the largest elements of the blocks.",
    sumOverBlocks((b) => ["Last", b]),
  ),
  stat("Antisingletons", "Elements i with i + 1 in the same block, counting n + 1 as 1.", antisingletons),
  stat(
    "SingletonsAndAntisingletons",
    "Singleton blocks plus antisingletons.",
    nonEmpty(add(singletonBlocks, antisingletons)),
  ),
  stat("BlocksAndAntisingletons", "Blocks plus antisingletons.", nonEmpty(add(["Length", "_x"], antisingletons))),
  stat("Successions", "Elements i with i + 1 in the same block.", nonEmpty(successions)),
  stat(
    "MaximalBlockDifference",
    "The largest difference between two elements of one block.",
    nonEmpty(["Max", ["Map", ["Function", blockSpan("b"), "b"], "_x"]]),
  ),
  stat("FirstBlockCardinality", "The size of the block containing 1.", nonEmpty(["Length", at(1)])),
  stat("LargestElementInFirstBlock", "The largest element of the block containing 1.", nonEmpty(["Last", at(1)])),
  stat(
    "InternalPoints",
    "Elements with an earlier and a later element whose blocks open after theirs does.",
    internalPoints,
    "An element e is internal when some f < e < g have blocks with larger least element than e's block (Mansour, Section 5.5).",
  ),
  stat("OverlappingBlockPairs", "Pairs of blocks A, B with min A < min B < max A < max B.", overlappingBlockPairs),
  stat(
    "SameBlockPairs",
    "Pairs of elements in one block.",
    sumOverBlocks((b) => pairsIn(["Length", b])),
  ),
  stat(
    "SameBlockTriples",
    "Triples of elements in one block.",
    sumOverBlocks((b) => triplesIn(["Length", b])),
  ),
  stat(
    "DistinctBlockPairs",
    "Pairs of elements in different blocks.",
    nonEmpty(
      subtract(
        pairsIn(groundSize),
        sumOverBlocks((b) => pairsIn(["Length", b])),
      ),
    ),
  ),
  stat(
    "DimensionExponent",
    "The sum over blocks of span minus (size - 1).",
    sumOverBlocks((b) => subtract(blockSpan(b), subtract(["Length", b], 1))),
  ),
  stat("LargestOpener", "The largest of the blocks' smallest elements.", nonEmpty(["Max", firsts])),
  stat("SmallestCloser", "The smallest of the blocks' largest elements.", nonEmpty(["Min", lasts])),
  stat("TerminalClosers", "Closers e with every larger element also a closer.", terminalClosers),
  stat(
    "BlocksWithOddMinimum",
    "Blocks whose smallest element is odd.",
    nonEmpty(["Count", ["Filter", firsts, ["Function", equals(["Mod", "f", 2], 1), "f"]]]),
  ),
  stat(
    "BlocksWithEvenMinimum",
    "Blocks whose smallest element is even.",
    nonEmpty(["Count", ["Filter", firsts, ["Function", equals(["Mod", "f", 2], 0), "f"]]]),
  ),
];
