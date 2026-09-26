// Set-partition statistics, over `_x` = the list of blocks, each block a list of elements.
//
// Almost everything here is a statement about the BLOCK SIZES, so that list is built once.
// Crossings and nestings are not: they read the standard ARC REPRESENTATION instead — within
// each block (already ascending), link consecutive elements — and compare arcs pairwise. See
// `ArcRepresentation` in @enumeratio/domains for the same construction as a typed map.

import type { Definition, MathJSON } from "./types.ts";
import {
  add,
  and,
  at,
  atLeastValue,
  bind,
  count,
  equals,
  forEach,
  length,
  less,
  nonEmpty,
  or,
  positions,
  subtract,
  sumOver,
  upTo,
} from "./vocabulary.ts";

const on = "SetPartition";
const stat = (head: string, summary: string, expr: Definition["expr"], note?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
});

/** The size of each block. */
const sizes: MathJSON = forEach(positions, ["Length", at("i")]);
const sizeHere: MathJSON = ["Length", at("i")];

// ── the standard arc representation ──────────────────────────────────────────────────────
//
// Within one block (already ascending), the consecutive pairs (b1,b2), (b2,b3), .... A
// `Fold`'s bound variable turns out not to survive being read from inside a NESTED fold's own
// step (only as that nested fold's INITIAL value, the way `iterate`/`orbitLeast` in
// @enumeratio/domains' map.ts use an outer index) — so this is built with `Map` throughout
// instead, one list of arcs per block, flattened with the native `Flatten`. And within that
// nesting, the OUTER bound variable is spelled "blk", never "i": "i" is compute-engine's
// imaginary unit, and a definition's `_x` is substituted in AFTER the expression is
// canonicalized (`applyDefinition` in declare.ts), which — only two `Map`s deep, only past
// that substitution — is enough for a reference to an outer "i" to read back as `Complex(0,1)`
// instead of the bound block index. One level deep it is fine (every other statistic here
// uses "i"); this is the one place that goes two deep, so it uses a name with no built-in
// meaning instead of relitigating why every time.

/** The i-th block, read fresh from `_x` every time. */
const blockAt = (i: MathJSON): MathJSON => at(i);
const blockLen = (i: MathJSON): MathJSON => ["Length", blockAt(i)];

/** Block i's own arcs, guarded against `Range(1, 0)` — a singleton block has none. */
const arcsOfBlockAt = (i: MathJSON): MathJSON => [
  "If",
  less(blockLen(i), 2),
  ["List"],
  forEach(upTo(subtract(blockLen(i), 1)), ["List", at("k", blockAt(i)), at(add("k", 1), blockAt(i))], "k"),
];

/** Every arc, in block order. Order does not matter below: crossing and nesting are read off
 *  each pair's endpoints directly, not off the arcs' position in this list. Guarded against
 *  `Range(1, 0)` — the empty partition (zero blocks) has none. */
const arcList: MathJSON = [
  "If",
  less(length(), 1),
  ["List"],
  ["Flatten", forEach(upTo(length()), arcsOfBlockAt("blk"), "blk"), 1],
];
/** The arcs as a bound name: `withArcs` evaluates `arcList` ONCE per definition, where the
 *  pairwise scans below would otherwise rebuild it at every `At` of every (i, j). */
const arcs: MathJSON = "arcs";
const withArcs = (body: MathJSON): MathJSON => bind("arcs", arcList, body);
const arcCount: MathJSON = ["Length", arcs];

const arcAt = (i: MathJSON): MathJSON => at(i, arcs);

/** [isCrossing, isNesting] for arc i against arc j, computed together so the shared terms —
 *  which arc starts first, and its partner's endpoints — are each stated once. Relabel the two arcs a < b by left endpoint (distinct: a
 *  position starts at most one arc); c is the right endpoint of whichever starts at a, d the
 *  other's. Crossing is then exactly a < b < c < d and nesting a < b < d < c — Kasraoui–Zeng's
 *  definitions, read off without knowing beforehand which arc is which. */
const pairFlags = (i: MathJSON, j: MathJSON): MathJSON => {
  const arcI = arcAt(i);
  const arcJ = arcAt(j);
  const p1 = at(1, arcI);
  const q1 = at(2, arcI);
  const p2 = at(1, arcJ);
  const q2 = at(2, arcJ);
  const iStartsFirst = less(p1, p2);
  const laterLeft: MathJSON = ["Max", p1, p2];
  const c: MathJSON = ["If", iStartsFirst, q1, q2];
  const d: MathJSON = ["If", iStartsFirst, q2, q1];
  const overlap = less(laterLeft, c);
  return ["List", and(overlap, less(c, d)), and(overlap, less(d, c))];
};
const isCrossing = (i: MathJSON, j: MathJSON): MathJSON => at(1, pairFlags(i, j));
const isNesting = (i: MathJSON, j: MathJSON): MathJSON => at(2, pairFlags(i, j));
/** 1 if (i, j) is crossing or nesting, reading pairFlags once instead of twice. */
const bothFlagsAt = (i: MathJSON, j: MathJSON): MathJSON =>
  bind("flags", pairFlags(i, j), ["If", or(at(1, "flags"), at(2, "flags")), 1, 0]);

/** Guard for a definition that reads a PAIR of arcs — needs at least two. */
const hasArcPair = (body: MathJSON): MathJSON => ["If", less(arcCount, 2), 0, body];
const laterArcs: MathJSON = ["Range", add("i", 1), arcCount];

const crossingPairs: MathJSON = sumOver(upTo(arcCount), count(laterArcs, isCrossing("i", "j"), "j"), "i");
const nestingPairs: MathJSON = sumOver(upTo(arcCount), count(laterArcs, isNesting("i", "j"), "j"), "i");
// Crossing and nesting are mutually exclusive per pair, so the total is how many pairs are
// either — one pass with bothFlagsAt, rather than the crossing and nesting loops separately.
const crossingOrNestingPairs: MathJSON = sumOver(upTo(arcCount), sumOver(laterArcs, bothFlagsAt("i", "j"), "j"), "i");
const crossings: MathJSON = withArcs(hasArcPair(crossingPairs));
const nestings: MathJSON = withArcs(hasArcPair(nestingPairs));
const crossingsAndNestings: MathJSON = withArcs(hasArcPair(crossingOrNestingPairs));

export const SET_PARTITION_STATISTICS: readonly Definition[] = [
  stat("Blocks", "The number of blocks.", ["Length", "_x"]),
  stat("LargestBlock", "The size of the largest block.", nonEmpty(["Max", sizes])),
  stat("SmallestBlock", "The size of the smallest block.", nonEmpty(["Min", sizes])),
  stat("BlockSizeSpan", "Largest block size minus smallest.", nonEmpty(subtract(["Max", sizes], ["Min", sizes]))),
  stat("SingletonBlocks", "Blocks containing exactly one element.", nonEmpty(count(positions, equals(sizeHere, 1)))),
  stat(
    "BlocksAtLeastTwo",
    "Blocks containing at least two elements.",
    nonEmpty(count(positions, atLeastValue(sizeHere, 2))),
  ),
  stat("BlocksSizeTwo", "Blocks containing exactly two elements.", nonEmpty(count(positions, equals(sizeHere, 2)))),
  stat("LastBlockSize", "The size of the final block.", nonEmpty(["Length", at(length())])),
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
