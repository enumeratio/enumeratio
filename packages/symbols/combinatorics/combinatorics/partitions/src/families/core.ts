// Partitions-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: IntegerPartitions and its four siblings, all typed by the "IntegerPartition"
// carrier. The generic kernel math they call stays in collections/src/families/kernels*.ts —
// reused across areas, not partitions-specific machinery.
//
// All five are defined in Epsil. Four are walks over a table of completions (./walks.ts), largest
// part first; their TS kernels (Euler's pentagonal-number recurrence, a distinct-parts DP,
// partsLeq) are `fast` paths in the same order. A partition's parts are in that order, never
// increasing, which `IsPartitionOf` and `IsDistinctPartitionOf` check (they once took any order).
//
// PartitionsInBox(a,b) is a lattice path instead, with no sum to walk:
// kernels-extra.ts's own PartitionsInBoxUnrank/Rank already reduce it to a lattice
// path (Binomial(a+b,a) of them) via the same colex combinatorial-number-system digit search as
// KSubsetRank/KSubsetUnrank, the compositions pilot's CompositionsIntoKParts/WeakCompositions
// (compositions/src/families/core.ts). See `partitionsInBox` below for the bijection this Epsil
// form follows.
import type { EpsilFamily, FastKernel } from "../../../collections/src/families/epsil.ts";
import { cell, colexDigits, lets, pascalTable } from "../../../collections/src/families/tables.ts";
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
  IsPartitionInBox,
  PartitionsInBoxCount,
  PartitionsInBoxRank,
  PartitionsInBoxUnrank,
} from "../../../collections/src/families/kernels-extra.ts";
import { distinctPartitions, integerPartitions, partitionsIntoKParts, partitionsMaxPart } from "./walks.ts";

const integerPartitionsFast: FastKernel = {
  count: ([n]) => PartitionsP(n),
  unrank: ([n], r) => IntegerPartitionUnrank(n, r),
  rank: (x, [n]) => IntegerPartitionRank(x as number[], n),
  valid: (x, [n]) => IsPartitionOf(x as number[], n),
};
const partitionsIntoKPartsFast: FastKernel = {
  count: ([n, k]) => KPartPartitionCount(n, k),
  unrank: ([n, k], r) => IntegerPartitionKUnrank(n, k, r),
  rank: (x, [n]) => IntegerPartitionKRank(x as number[], n),
  valid: (x, [n, k]) => IsPartitionOf(x as number[], n, k),
};
const distinctPartitionsFast: FastKernel = {
  count: ([n]) => PartitionsQ(n),
  unrank: ([n], r) => DistinctPartitionUnrank(n, r),
  rank: (x, [n]) => DistinctPartitionRank(x as number[], n),
  valid: (x, [n]) => IsDistinctPartitionOf(x as number[], n),
};
const partitionsMaxPartFast: FastKernel = {
  count: ([n, m]) => PartitionsMaxPartCount(n, m),
  unrank: ([n, m], r) => PartitionsMaxPartUnrank(n, m, r),
  rank: (x, [, m]) => PartitionsMaxPartRank(x as number[], m),
  valid: (x, [n, m]) => IsPartitionMaxPart(x as number[], n, m),
};

export const entries: EpsilFamily[] = [
  { ...integerPartitions, fast: integerPartitionsFast },
  { ...partitionsIntoKParts, fast: partitionsIntoKPartsFast },
  { ...distinctPartitions, fast: distinctPartitionsFast },
  { ...partitionsMaxPart, fast: partitionsMaxPartFast },
];

// ─── PartitionsInBox(a,b): partitions with ≤ a parts, each ≤ b — a lattice path, closed form ───
// kernels-extra.ts's PartitionsInBoxUnrank walks a 0/1 lattice path (a N-steps, b E-steps) built
// by KSubsetUnrank(a+b, a, rank): the N-steps sit at the colex rank's a ascending positions
// P_1 < … < P_a in 1..a+b, and part_m = b − P_m + m (an N-step at position P_m has had m−1 earlier
// N-steps and P_m−m E-steps before it; the part is what's left of the row, b minus those E-steps).
// Trailing zero parts (an unused N-slot) are dropped, which a Filter reproduces since part_m is
// weakly decreasing in m. Rank runs the bijection backwards — P_m from a (possibly padded-with-
// zero) part — directly, no digit search needed, since `_x` already gives every part_m.

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
const binom = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];

const universe = add("_a", "_b"); // a + b: the lattice path's total step count
// Every Binomial(c, i) below is a lookup in Pascal's triangle, built once per params as `tables`.
const pascalWidth = add("_a", 1);
const pascal = cell("_tables", pascalWidth);
/** part_m for m = 1.._a, before dropping trailing zeros: b − P_m + m, P_m the m-th colex position. */
const partAt = (m: MathJSON, positionOf: (m: MathJSON) => MathJSON): MathJSON => add(sub("_b", positionOf(m)), m);
/** `_x`'s entry j, or 0 past its length (the padding PartitionsInBoxRank pads with explicitly). */
const partOrZero = (j: MathJSON): MathJSON => ["If", ["LessEqual", j, lengthOf("_x")], element(j), 0];
/** The colex position a part at index j (1-based) reconstructs to: b − part_j + j. */
const positionOfElement = (j: MathJSON): MathJSON => add(sub("_b", partOrZero(j)), j);

// unrank's P_m needs the colex digit search (rank -> position), done in one pass; rank's
// positionOfElement reads `_x` directly, no search needed — see the block comment above.
const positionFromRank = (m: MathJSON): MathJSON => add(at("pb_digits", add(m, 1)), 1);

const partitionsInBox: EpsilFamily = {
  head: "PartitionsInBox",
  carrier: "IntegerPartition",
  paramCount: 2,
  kind: "ints",
  params: ["_a", "_b"],
  fast: {
    count: ([a, b]) => PartitionsInBoxCount(a, b),
    unrank: ([a, b], r) => PartitionsInBoxUnrank(a, b, r),
    rank: (x, [a, b]) => PartitionsInBoxRank(x as number[], a, b),
    valid: (x, [a, b]) => IsPartitionInBox(x as number[], a, b),
  },
  epsil: {
    count: binom(universe, "_a"),
    tables: pascalTable("pc", ["Max", universe, 1], pascalWidth),
    unrank: lets(
      [["pb_digits", colexDigits("pb", "_a", universe, pascal), "list<integer>"]],
      [
        "Filter",
        ["Map", ["Function", partAt("m", positionFromRank), "m"], upTo(1, "_a")],
        ["Function", ["Greater", "_t", 0], "_t"],
      ],
    ),
    rank: fold(add("acc", pascal(sub(positionOfElement("j"), 1), "j")), "acc", "j", 0, upTo(1, "_a")),
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
