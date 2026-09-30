// Partitions-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: IntegerPartitions and its four siblings, all typed by the "IntegerPartition"
// carrier. The generic kernel math they call stays in collections/src/families/kernels*.ts —
// reused across areas, not partitions-specific machinery.
//
// Four of the five stay TS kernels (BL-30's documented exception): IntegerPartitions,
// PartitionsIntoKParts and DistinctPartitions unrank/rank through Euler's pentagonal-number
// recurrence or a distinct-parts DP (PartitionsP/KPartPartitionCount/PartitionsQ in
// kernels-combinatorics.ts / kernels-extra.ts) — a table over a shrinking (remaining sum, part
// cap) budget, not a closed expression. PartitionsMaxPart is the same shape (partsLeq). Unlike a
// composition, a partition's parts aren't independent digits of a fixed-radix or combinatorial
// number system: how many partitions of m remain with parts ≤ cap has no closed form in cap, so
// there's no fold to write in its place.
//
// PartitionsInBox(a,b) is the exception to the exception: "≤ a parts, each ≤ b" has no such
// dependency — kernels-extra.ts's own PartitionsInBoxUnrank/Rank already reduce it to a lattice
// path (Binomial(a+b,a) of them) via the same colex combinatorial-number-system digit search as
// KSubsetRank/KSubsetUnrank, the compositions pilot's CompositionsIntoKParts/WeakCompositions
// (compositions/src/families/core.ts). See `partitionsInBox` below for the bijection this Epsil
// form follows.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  PartitionsP,
  IntegerPartitionUnrank,
  IntegerPartitionRank,
  IsPartitionOf,
  KPartPartitionCount,
  IntegerPartitionKUnrank,
  IntegerPartitionKRank,
} from "../../../collections/src/families/kernels-combinatorics.ts";
import {
  PartitionsQ,
  DistinctPartitionUnrank,
  DistinctPartitionRank,
  IsDistinctPartitionOf,
  PartitionsMaxPartCount,
  PartitionsMaxPartUnrank,
  PartitionsMaxPartRank,
  IsPartitionMaxPart,
} from "../../../collections/src/families/kernels-extra.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors collections/core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

export const entries: NumberKernel[] = [
  // ── partitions (DP over a shrinking budget — see the file comment) ──
  {
    ...ints(
      "IntegerPartitions",
      1,
      ([n]) => PartitionsP(n),
      ([n], r) => IntegerPartitionUnrank(n, r),
      (a, [n]) => IsPartitionOf(a, n),
      (a, [n]) => IntegerPartitionRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "PartitionsIntoKParts",
      2,
      ([n, k]) => KPartPartitionCount(n, k),
      ([n, k], r) => IntegerPartitionKUnrank(n, k, r),
      (a, [n, k]) => IsPartitionOf(a, n, k),
      (a, [n]) => IntegerPartitionKRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "DistinctPartitions",
      1,
      ([n]) => PartitionsQ(n),
      ([n], r) => DistinctPartitionUnrank(n, r),
      (a, [n]) => IsDistinctPartitionOf(a, n),
      (a, [n]) => DistinctPartitionRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "PartitionsMaxPart",
      2,
      ([n, m]) => PartitionsMaxPartCount(n, m),
      ([n, m], r) => PartitionsMaxPartUnrank(n, m, r),
      (a, [n, m]) => IsPartitionMaxPart(a, n, m),
      (a, [, m]) => PartitionsMaxPartRank(a, m),
    ),
    carrier: "IntegerPartition",
  },
];

// ─── PartitionsInBox(a,b): partitions with ≤ a parts, each ≤ b — a lattice path, closed form ───
// kernels-extra.ts's PartitionsInBoxUnrank walks a 0/1 lattice path (a N-steps, b E-steps) built
// by KSubsetUnrank(a+b, a, rank): the N-steps sit at the colex rank's a ascending positions
// P_1 < … < P_a in 1..a+b, and part_m = b − P_m + m (an N-step at position P_m has had m−1 earlier
// N-steps and P_m−m E-steps before it; the part is what's left of the row, b minus those E-steps).
// Trailing zero parts (an unused N-slot) are dropped, which a Filter reproduces since part_m is
// weakly decreasing in m. Rank runs the bijection backwards — P_m from a (possibly padded-with-
// zero) part — directly, no digit search needed, since `_x` already gives every part_m.
//
// `binom` guards Binomial for k outside 0..n: compute-engine's compiled Binomial returns
// undefined there (the interpreter gives 0) — cortex-js/compute-engine#384. Guarding here (not
// just leaving the operation interpreted) is what lets compile-families.ts's agreement check
// pass compiled code for `count` and `rank`, which call it directly with `_a`/`m` that can be
// 0 or _a. A-135 is adding a shared helper for this on #507; inline until the rebase.
type MathJSON = unknown;
const add = (...xs: MathJSON[]): MathJSON => ["Add", ...xs];
const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const upTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
const fold = (body: MathJSON, accumulator: string, variable: string, init: MathJSON, over: MathJSON): MathJSON => [
  "Fold",
  ["Function", body, accumulator, variable],
  init,
  over,
];
const element = (j: MathJSON): MathJSON => at("_x", j);
const lengthOf = (x: MathJSON): MathJSON => ["Length", x];
const binom = (n: MathJSON, k: MathJSON): MathJSON => [
  "If",
  ["And", ["LessEqual", 0, k], ["LessEqual", k, n]],
  ["Binomial", n, k],
  0,
];

const universe = add("_a", "_b"); // a + b: the lattice path's total step count
/** part_m for m = 1.._a, before dropping trailing zeros: b − P_m + m, P_m the m-th colex position. */
const partAt = (m: MathJSON, positionOf: (m: MathJSON) => MathJSON): MathJSON => add(sub("_b", positionOf(m)), m);
/** `_x`'s entry j, or 0 past its length (the padding PartitionsInBoxRank pads with explicitly). */
const partOrZero = (j: MathJSON): MathJSON => ["If", ["LessEqual", j, lengthOf("_x")], element(j), 0];
/** The colex position a part at index j (1-based) reconstructs to: b − part_j + j. */
const positionOfElement = (j: MathJSON): MathJSON => add(sub("_b", partOrZero(j)), j);

// unrank's P_m needs the actual combinatorial-number-system digit search (rank -> position);
// rank's positionOfElement reads `_x` directly, no search needed — see the block comment above.
const digitAt = (i: MathJSON, rIn: MathJSON, tag: string): MathJSON => {
  const c = `c_${tag}`;
  const best = `best_${tag}`;
  return fold(["If", ["LessEqual", binom(c, i), rIn], c, best], best, c, sub(i, 1), upTo(sub(i, 1), sub(universe, 1)));
};
const rBefore = (i: MathJSON, tag: string): MathJSON => {
  const hi = `hi_${tag}`;
  const acc = `racc_${tag}`;
  return fold(sub(acc, binom(digitAt(hi, acc, `${tag}i`), hi)), acc, hi, "_r", ["Range", "_a", add(i, 1), -1]);
};
/** The m-th smallest (1-based, ascending) N-step position, from the rank via colex digit search. */
const positionFromRank = (m: MathJSON, tag: string): MathJSON => add(digitAt(m, rBefore(m, `${tag}r`), `${tag}d`), 1);

const partitionsInBox: EpsilFamily = {
  head: "PartitionsInBox",
  carrier: "IntegerPartition",
  paramCount: 2,
  kind: "ints",
  params: ["_a", "_b"],
  epsil: {
    count: binom(universe, "_a"),
    unrank: [
      "Filter",
      ["Map", ["Function", partAt("m", (m) => positionFromRank(m, "U")), "m"], upTo(1, "_a")],
      ["Function", ["Greater", "_t", 0], "_t"],
    ],
    rank: fold(add("acc", binom(sub(positionOfElement("j"), 1), "j")), "acc", "j", 0, upTo(1, "_a")),
    // ≤ a parts, each in 1..b, weakly decreasing — no sum constraint (a and b bound the box, not
    // a target total).
    valid: [
      "And",
      ["LessEqual", lengthOf("_x"), "_a"],
      fold(
        [
          "And",
          "okv",
          [
            "And",
            ["GreaterEqual", element("jv"), 1],
            [
              "And",
              ["LessEqual", element("jv"), "_b"],
              ["If", ["Greater", "jv", 1], ["LessEqual", element("jv"), element(sub("jv", 1))], "True"],
            ],
          ],
        ],
        "okv",
        "jv",
        "True",
        upTo(1, lengthOf("_x")),
      ),
    ],
  },
};

export const epsilEntries: readonly EpsilFamily[] = [partitionsInBox];
