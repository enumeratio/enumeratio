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
  atMostValue,
  count,
  equals,
  forEach,
  greater,
  less,
  max,
  min,
  nonEmpty,
  or,
  subtract,
  sumOver,
  where,
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

// ── elements read through the block each lies in ─────────────────────────────────────────
//
// Block-pair and pattern statistics compare elements by their blocks. Everything below is a
// scalar expression in the elements, written inline rather than bound: the JavaScript compiler
// lowers it, and recomputing a small list per iteration is cheap there.

const blockCount: MathJSON = ["Length", "_x"];
/** The ground set's size, with no function literal inside, for use in nested loops. */
const n: MathJSON = ["Length", ["Flatten", "_x"]];
/** The number (from 1, by least element) of the block holding element e. */
const blockOf = (e: MathJSON): MathJSON =>
  sumOver(["Range", 1, blockCount], ["If", ["Contains", at("q"), e], "q", 0], "q");
const sameBlock = (a: MathJSON, b: MathJSON): MathJSON => equals(blockOf(a), blockOf(b));
const differentBlocks = (a: MathJSON, b: MathJSON): MathJSON => greater(["Abs", subtract(blockOf(a), blockOf(b))], 0);
const isOpener = (e: MathJSON): MathJSON => ["Contains", firsts, e];
const isCloser = (e: MathJSON): MathJSON => ["Contains", lasts, e];
const isSingleton = (e: MathJSON): MathJSON => and(isOpener(e), isCloser(e));

/** Pairs of elements a < b satisfying `condition`. */
const pairsWhere = (condition: (a: MathJSON, b: MathJSON) => MathJSON): MathJSON => [
  "If",
  less(n, 2),
  0,
  sumOver(["Range", 1, subtract(n, 1)], count(["Range", add("a", 1), n], condition("a", "b"), "b"), "a"),
];
/** Triples of elements a < b < c satisfying `condition`. */
const triplesWhere = (condition: (a: MathJSON, b: MathJSON, c: MathJSON) => MathJSON): MathJSON => [
  "If",
  less(n, 3),
  0,
  sumOver(
    ["Range", 1, subtract(n, 2)],
    sumOver(
      ["Range", add("a", 1), subtract(n, 1)],
      count(["Range", add("b", 1), n], condition("a", "b", "c"), "c"),
      "b",
    ),
    "a",
  ),
];
/** Quadruples of elements a < b < c < d satisfying `condition`. */
const quadruplesWhere = (condition: (a: MathJSON, b: MathJSON, c: MathJSON, d: MathJSON) => MathJSON): MathJSON => [
  "If",
  less(n, 4),
  0,
  sumOver(
    ["Range", 1, subtract(n, 3)],
    sumOver(
      ["Range", add("a", 1), subtract(n, 2)],
      sumOver(
        ["Range", add("b", 1), subtract(n, 1)],
        count(["Range", add("c", 1), n], condition("a", "b", "c", "d"), "d"),
        "c",
      ),
      "b",
    ),
    "a",
  ),
];

/** Pairs a < b in different blocks with no element of either block strictly between them. */
const intertwiningNumber: MathJSON = pairsWhere((a, b) =>
  and(
    differentBlocks(a, b),
    equals(
      count(["Range", 1, n], and(and(greater("e", a), less("e", b)), or(sameBlock("e", a), sameBlock("e", b))), "e"),
      0,
    ),
  ),
);

/** Guard for a definition that pairs elements of different blocks — needs at least two. */
const hasTwoBlocks = (body: MathJSON): MathJSON => ["If", less(blockCount, 2), 0, body];

const openerOf = (k: MathJSON): MathJSON => ["At", at(k), 1];
const closerOf = (k: MathJSON): MathJSON => ["Last", at(k)];

/** Pairs (j, i) with j the opener or closer of block k and i an
 *  element of an earlier (`before`) or later block, counted where `compare(i, j)` holds. */
const endpointPairs = (
  ends: (block: MathJSON) => MathJSON,
  before: boolean,
  compare: (i: MathJSON, j: MathJSON) => MathJSON,
): MathJSON =>
  sumOver(
    ["Range", 1, blockCount],
    count(["Range", 1, n], and((before ? less : greater)(blockOf("i"), "k"), compare("i", ends("k"))), "i"),
    "k",
  );

/** The sum of the positions i of the list `word` with word[i] > word[i + 1]. */
const majorIndexOf = (word: MathJSON): MathJSON => [
  "If",
  less(["Length", word], 2),
  0,
  sumOver(["Range", 1, subtract(["Length", word], 1)], ["If", greater(at("i", word), at(add("i", 1), word)), "i", 0]),
];
const blockMajorIndex: MathJSON = [
  "If",
  less(blockCount, 2),
  0,
  sumOver(
    ["Range", 1, subtract(blockCount, 1)],
    ["Multiply", "i", count(at("i"), greater("e", ["At", at(add("i", 1)), 1]), "e")],
  ),
];
const flattened: MathJSON = ["Flatten", "_x"];
/** Plus, for each block ending before the next begins, the elements beyond the first in the blocks so far. */
const flattenedMajorIndexVariant: MathJSON = add(majorIndexOf(flattened), [
  "If",
  less(blockCount, 2),
  0,
  sumOver(
    ["Range", 1, subtract(blockCount, 1)],
    [
      "If",
      less(["Last", at("i")], ["At", at(add("i", 1)), 1]),
      sumOver(["Range", 1, blockCount], ["If", atMostValue("t", "i"), subtract(["Length", at("t")], 1), 0], "t"),
      0,
    ],
  ),
]);

/** The least l for which the first l blocks hold exactly 1 .. m: their greatest element is their size. */
const firstAtomicBlocks: MathJSON = [
  "Min",
  where(
    ["Range", 1, blockCount],
    equals(max(forEach(["Range", 1, blockCount], ["If", atMostValue("t", "l"), ["Last", at("t")], 0], "t")), [
      "Sum",
      forEach(["Range", 1, blockCount], ["If", atMostValue("t", "l"), ["Length", at("t")], 0], "t"),
    ]),
    "l",
  ),
];

/** n - i summed over the arcs i = 1 .. A, less the arcs strictly over each element, plus the arcs strictly over each arc. */
const depthIndex: MathJSON = [
  "If",
  equals(arcCount, 0),
  0,
  subtract(
    add(
      subtract(["Multiply", arcCount, n], ["Divide", ["Multiply", arcCount, add(arcCount, 1)], 2]),
      sumOver(
        allArcs,
        count(allArcs, and(less(at("m", lefts), at("k", lefts)), less(at("k", rights), at("m", rights))), "m"),
        "k",
      ),
    ),
    // The arcs over each element, summed over elements, is the elements under each arc, summed over arcs.
    sumOver(allArcs, subtract(subtract(at("k", rights), at("k", lefts)), 1), "k"),
  ),
];

const ascentTopsAfterSmaller: MathJSON = [
  "If",
  less(n, 2),
  0,
  count(
    ["Range", 1, subtract(n, 1)],
    and(
      less(at("i", flattened), at(add("i", 1), flattened)),
      // Every smaller element lies before: exactly top - 1 earlier entries are smaller.
      equals(
        count(["Range", 1, "i"], less(at("j", flattened), at(add("i", 1), flattened)), "j"),
        subtract(at(add("i", 1), flattened), 1),
      ),
    ),
  ),
];

/** Blocks s < t whose i-th arcs interlace, each block's arcs closed off by an arc to n + 1. */
const interlacingNumber: MathJSON = (() => {
  /** The j-th element of block s, with n + 1 appended. */
  const elementOf = (s: MathJSON, j: MathJSON): MathJSON => [
    "If",
    greater(j, ["Length", at(s)]),
    add(n, 1),
    ["At", at(s), j],
  ];
  const [sa, sb, ta, tb] = [
    elementOf("s", "i"),
    elementOf("s", add("i", 1)),
    elementOf("t", "i"),
    elementOf("t", add("i", 1)),
  ];
  return [
    "If",
    less(blockCount, 2),
    0,
    sumOver(
      ["Range", 1, subtract(blockCount, 1)],
      sumOver(
        ["Range", add("s", 1), blockCount],
        count(
          ["Range", 1, ["Min", ["Length", at("s")], ["Length", at("t")]]],
          or(and(less(sa, ta), and(less(ta, sb), less(sb, tb))), and(less(ta, sa), and(less(sa, tb), less(tb, sb)))),
        ),
        "t",
      ),
      "s",
    ),
  ];
})();

const firstBlockSecondElementOrSmallestCloser: MathJSON = [
  "If",
  equals(["Length", at(1)], 1),
  1,
  min(["List", ["At", at(1), 2], min(forEach(where("_x", greater(["Length", "b"], 1), "b"), ["Last", "b"], "b"))]),
];

// ── the word of block numbers, blocks ordered by greatest element (FindStat's Mahonian word) ──

/** The number (from 0, by greatest element) of the block holding element e: the Mahonian word's letter at e. */
const letterAt = (e: MathJSON): MathJSON => {
  const greatest = sumOver(["Range", 1, blockCount], ["If", ["Contains", at("q"), e], ["Last", at("q")], 0], "q");
  return count(lasts, less("c", greatest), "c");
};
const mahonianDescents: MathJSON = [
  "If",
  less(n, 2),
  0,
  count(["Range", 1, subtract(n, 1)], greater(letterAt("i"), letterAt(add("i", 1)))),
];
const mahonianInversions: MathJSON = [
  "If",
  less(n, 2),
  0,
  sumOver(["Range", 1, subtract(n, 1)], count(["Range", add("i", 1), n], greater(letterAt("i"), letterAt("j")), "j")),
];
const mahonianMajorIndex: MathJSON = [
  "If",
  less(n, 2),
  0,
  sumOver(["Range", 1, subtract(n, 1)], ["If", greater(letterAt("i"), letterAt(add("i", 1))), "i", 0]),
];
/** Excedances: positions where the word exceeds its nondecreasing rearrangement, whose i-th entry is
 *  the number of blocks whose letters, with every earlier block's, all lie before position i. */
const mahonianExcedances: MathJSON = count(
  ["Range", 1, n],
  greater(
    letterAt("i"),
    count(
      ["Range", 1, blockCount],
      less(
        sumOver(
          ["Range", 1, blockCount],
          ["If", atMostValue(at("c", lasts), at("k", lasts)), ["Length", at("c")], 0],
          "c",
        ),
        "i",
      ),
      "k",
    ),
  ),
);
/** The major index of the word restricted to each pair of letters r < s, summed. */
const zIndex: MathJSON = [
  "If",
  less(blockCount, 2),
  0,
  sumOver(
    ["Range", 0, subtract(blockCount, 2)],
    sumOver(
      ["Range", add("r", 1), subtract(blockCount, 1)],
      majorIndexOf(where(forEach(["Range", 1, n], letterAt("e"), "e"), or(equals("v", "r"), equals("v", "s")), "v")),
      "s",
    ),
    "r",
  ),
];

/** i moved k places on, wrapping from n round to 1. */
const rotated = (i: MathJSON, k: MathJSON): MathJSON => add(["Mod", subtract(add(i, k), 1), n], 1);
/** The least k for which rotating by k keeps the same elements together. */
const rotationOrbitSize: MathJSON = [
  "Min",
  where(
    ["Range", 1, n],
    equals(
      sumOver(
        ["Range", 1, n],
        count(
          ["Range", 1, n],
          greater(
            [
              "Abs",
              subtract(
                ["If", sameBlock("i", "j"), 1, 0],
                ["If", sameBlock(rotated("i", "k"), rotated("j", "k")), 1, 0],
              ),
            ],
            0,
          ),
          "j",
        ),
        "i",
      ),
      0,
    ),
    "k",
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
  stat(
    "RotationOrbitSize",
    "The number of distinct partitions rotation i -> i + 1 (mod n) makes of this one.",
    nonEmpty(rotationOrbitSize),
  ),
  stat(
    "IntertwiningNumber",
    "Pairs a < b in different blocks with no element of either block between them.",
    intertwiningNumber,
    "The block intertwiners of Ehrenborg and Readdy (Juggling and applications to q-analogues), counted over all pairs of blocks.",
  ),
  // Steingrímsson's statistics, by which end of block k (opener = least, closer = greatest) is
  // compared with the elements of the blocks before or after it.
  stat(
    "RightOpenerSmaller",
    "Pairs of an opener j and a larger element i of an earlier block.",
    hasTwoBlocks(endpointPairs(openerOf, true, greater)),
    "FindStat's ros (right, opener, smaller): an inversion of the set partition in Steingrímsson's sense.",
  ),
  stat(
    "RightOpenerBigger",
    "Pairs of an opener j and a smaller element i of an earlier block.",
    hasTwoBlocks(endpointPairs(openerOf, true, less)),
    "FindStat's rob (right, opener, bigger).",
  ),
  stat(
    "LeftOpenerSmaller",
    "Pairs of an opener j and a larger element i of a later block.",
    hasTwoBlocks(endpointPairs(openerOf, false, greater)),
    "FindStat's los (left, opener, smaller), the dual major index.",
  ),
  stat(
    "RightCloserSmaller",
    "Pairs of a closer j and a larger element i of an earlier block.",
    hasTwoBlocks(endpointPairs(closerOf, true, greater)),
    "FindStat's rcs (right, closer, smaller).",
  ),
  stat(
    "RightCloserBigger",
    "Pairs of a closer j and a smaller element i of an earlier block.",
    hasTwoBlocks(endpointPairs(closerOf, true, less)),
    "FindStat's rcb (right, closer, bigger).",
  ),
  stat(
    "LeftCloserSmaller",
    "Pairs of a closer j and a larger element i of a later block.",
    hasTwoBlocks(endpointPairs(closerOf, false, greater)),
    "FindStat's lcs (left, closer, smaller).",
  ),
  stat(
    "LeftCloserBigger",
    "Pairs of a closer j and a smaller element i of a later block.",
    hasTwoBlocks(endpointPairs(closerOf, false, less)),
    "FindStat's lcb (left, closer, bigger).",
  ),
  stat(
    "BlockMajorIndex",
    "The sum over blocks i of i times the elements of block i above the least element of block i + 1.",
    blockMajorIndex,
  ),
  stat(
    "FlattenedMajorIndex",
    "The major index of the permutation listing the blocks in order, each ascending.",
    majorIndexOf(flattened),
  ),
  stat(
    "HuangRhoadesMajorIndex",
    "The major index of the flattened permutation, plus for each block ending before the next begins the elements so far beyond each block's first.",
    flattenedMajorIndexVariant,
    "Huang and Rhoades' variant (Ordered set partitions and the 0-Hecke algebra, eq. 2.7).",
  ),
  stat(
    "FirstAtomicComponentBlockCount",
    "The least l for which the first l blocks hold exactly 1 .. m.",
    nonEmpty(firstAtomicBlocks),
  ),
  stat(
    "DepthIndex",
    "The sum of n - i over the arcs i, less the depth of each element, plus the depth of each arc.",
    depthIndex,
    "An element's depth is the arcs strictly over it; an arc's, the arcs strictly over it.",
  ),
  stat(
    "FlattenedAscentTopsAfterSmaller",
    "Ascent tops of the flattened word with every smaller element earlier.",
    ascentTopsAfterSmaller,
    "The binary logarithm of the number of set partitions with the same flattened word.",
  ),
  stat(
    "InterlacingNumber",
    "Pairs of blocks whose i-th arcs interlace, each block closed by an arc to infinity.",
    interlacingNumber,
  ),
  stat(
    "FirstBlockSecondOrSmallestNonsingletonMaximum",
    "The smaller of the second element of the block holding 1 and the smallest closer; 1 when {1} is a block.",
    nonEmpty(firstBlockSecondElementOrSmallestCloser),
    "A closer is the greatest element of a non-singleton block.",
  ),
  // The Mahonian word numbers each element's block, the blocks ordered by greatest element.
  stat("MahonianWordExcedances", "Excedances of the Mahonian word.", nonEmpty(mahonianExcedances)),
  stat("MahonianWordDescents", "Descents of the Mahonian word.", mahonianDescents),
  stat("MahonianWordInversions", "Inversions of the Mahonian word.", mahonianInversions),
  stat("MahonianWordMajorIndex", "The major index of the Mahonian word.", mahonianMajorIndex),
  stat(
    "MahonianWordZIndex",
    "The major indices of the Mahonian word restricted to each pair of letters, summed.",
    zIndex,
  ),
  // Klazar occurrences of a pattern: "/" separates its blocks, so 13/2 is {{1,3},{2}}.
  stat(
    "OccurrencesOf12Over3",
    "Occurrences of the pattern 12/3: a < b in one block and c > b in another.",
    triplesWhere((a, b, c) => and(sameBlock(a, b), differentBlocks(a, c))),
  ),
  stat(
    "OccurrencesOf13Over2",
    "Occurrences of the pattern 13/2: a < c in one block with b between them in another.",
    triplesWhere((a, b, c) => and(sameBlock(a, c), differentBlocks(a, b))),
  ),
  stat(
    "OccurrencesOf1Over23",
    "Occurrences of the pattern 1/23: b < c in one block and a < b in another.",
    triplesWhere((a, b, c) => and(sameBlock(b, c), differentBlocks(a, b))),
  ),
  stat(
    "OccurrencesOf1Over2Over3",
    "Occurrences of the pattern 1/2/3: a < b < c in three different blocks.",
    triplesWhere((a, b, c) => and(differentBlocks(a, b), and(differentBlocks(a, c), differentBlocks(b, c)))),
  ),
  stat(
    "OccurrencesOf13Over24",
    "Occurrences of the pattern 13/24: a < b < c < d with a, c in one block and b, d in another.",
    quadruplesWhere((a, b, c, d) => and(sameBlock(a, c), and(sameBlock(b, d), differentBlocks(a, b)))),
  ),
  stat(
    "OccurrencesOf12Over34",
    "Occurrences of the pattern 12/34: a < b < c < d with a, b in one block and c, d in another.",
    quadruplesWhere((a, b, c, d) => and(sameBlock(a, b), and(sameBlock(c, d), differentBlocks(a, c)))),
  ),
  // Pairs a < b in different blocks (DistinctBlockPairs), restricted at either end.
  stat(
    "SingletonBeforeCloserPairs",
    "Pairs a < b in different blocks with a a singleton block and b the greatest element of its block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), and(isSingleton(a), isCloser(b)))),
  ),
  stat(
    "OpenerBeforeCloserPairs",
    "Pairs a < b in different blocks with a the least and b the greatest element of its block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), and(isOpener(a), isCloser(b)))),
  ),
  stat(
    "CloserBeforeSingletonPairs",
    "Pairs a < b in different blocks with a the greatest element of its block and b a singleton block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), and(isCloser(a), isSingleton(b)))),
  ),
  stat(
    "CloserBeforeOpenerPairs",
    "Pairs a < b in different blocks with a the greatest and b the least element of its block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), and(isCloser(a), isOpener(b)))),
  ),
  stat(
    "SingletonBeforeLargerPairs",
    "Pairs a < b in different blocks with a a singleton block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), isSingleton(a))),
  ),
  stat(
    "SmallerBeforeCloserPairs",
    "Pairs a < b in different blocks with b the greatest element of its block.",
    pairsWhere((a, b) => and(differentBlocks(a, b), isCloser(b))),
  ),
];
