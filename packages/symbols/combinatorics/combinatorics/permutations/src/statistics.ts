// Permutation statistics, each defined as an expression over `_x` — a one-line word, the
// list `[p(1), …, p(n)]`.
//
// These ARE the implementations: `declareStatistics` evaluates the expression. There is no
// separate fast path to drift from, and `tests/permutation.test.ts` checks every one against
// an independent reading over every permutation of 1..6.

import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import {
  adjacent,
  and,
  atLeastValue,
  atMostValue,
  count,
  distance,
  equals,
  fallsAfter,
  fromHere,
  greater,
  hasPair,
  hasTriple,
  here,
  interior,
  length,
  less,
  max,
  min,
  next,
  nonEmpty,
  positions,
  previous,
  risesAfter,
  sumOver,
  upToHere,
  where,
  at,
  add,
  carried,
  fold,
  forEach,
  subtract,
  visiting,
  x,
} from "../../src/statistics/vocabulary.ts";

const on = "Permutation";
const INFINITY: MathJSON = { num: "+Infinity" };
const stat = (head: string, summary: string, expr: Definition["expr"], note?: string, result?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
  ...(result ? { result } : {}),
});

/**
 * A statistic that is ALSO a plain list function. These compare entries with each OTHER and
 * never with their positions, so the same reading applies to any integer sequence:
 * `Descents([3, 1, 2])` is a sensible question. Everything declared with `stat` reads a
 * value against its position, or walks the orbits, and means nothing without a bijection
 * behind it — `Cycles([3, 1, 2])` is not a question, it is a type error.
 */
const word = (head: string, summary: string, expr: Definition["expr"], note?: string): Definition => ({
  ...stat(head, summary, expr, note),
  alsoOnList: true,
});

/** i < j with p(i) > p(j) — counted as, for each i, how many later entries it dominates. */
const inversions = sumOver(positions, count(["Range", add("i", 1), length()], greater(here, at("j")), "j"));

// Denert's statistic (Foata–Zeilberger, FindStat St000156).
//
// Split the positions into the excedance block Exc = { i : p(i) > i } and its complement,
// each read in its original order as a subword. den(p) is the sum of the excedance
// positions, plus the inversions WITHIN each subword — inversions straddling the two blocks
// do not count. This was on the frontier as needing "a growing table Fold cannot carry"; it
// needs no fold at all, just the same filtered double-sum Inversions already uses, restricted
// to same-block pairs.
const isExcedanceAt = (i: MathJSON): MathJSON => greater(at(i), i);
const isNonExcedanceAt = (i: MathJSON): MathJSON => atMostValue(at(i), i);
/** Inversions among positions i < j that both satisfy `inBlock`. */
const blockInversions = (inBlock: (i: MathJSON) => MathJSON): MathJSON =>
  sumOver(positions, [
    "If",
    inBlock("i"),
    count(["Range", add("i", 1), length()], and(inBlock("j"), greater(here, at("j"))), "j"),
    0,
  ]);
const denert: MathJSON = nonEmpty(
  add(
    add(["Sum", where(positions, isExcedanceAt("i"))], blockInversions(isExcedanceAt)),
    blockInversions(isNonExcedanceAt),
  ),
);

/** Occurrences of a length-3 pattern, as a triple loop over i < j < k. */
const occurrencesOfPattern = (relation: (a: string, b: string, c: string) => Definition["expr"]) =>
  sumOver(
    positions,
    sumOver(
      ["Range", add("i", 1), length()],
      count(["Range", add("j", 1), length()], relation("i", "j", "k"), "k"),
      "j",
    ),
  );

/** Longest run of consecutive increases, carried as (best, current, previous value). */
const longestIncreasingRun: MathJSON = [
  "At",
  fold(
    x,
    ["List", 0, 0, 0],
    [
      "If",
      ["Greater", visiting, carried(3)],
      ["List", ["Max", ["List", carried(1), ["Add", carried(2), 1]]], ["Add", carried(2), 1], visiting],
      ["List", ["Max", ["List", carried(1), 1]], 1, visiting],
    ],
  ),
  1,
];

// ── cycle structure ──────────────────────────────────────────────────────────────────────
//
// A permutation of size n returns every point to itself within n steps, so i's cycle is found
// by walking from i for n steps. The walk is a fold whose state is one integer: the point
// reached, or, once the walk has settled, a non-positive marker that the remaining steps carry
// through unchanged. No map, no visited set, no list-valued state: O(n) per point, O(n²) in
// all, and it compiles.
//
// i LEADS its cycle when it is the cycle's smallest point. That turns "the set of cycles" into a
// filter over positions, the shape everything else here already uses.

/** The steps of a walk: n of them, enough to go round any cycle. */
const steps: MathJSON = ["Range", 1, length(), 1];

/** Whether i leads its cycle: walking from p(i), the walk gets back to i (marker 0) before it
 *  meets anything smaller (marker -1). */
const leads = (i: MathJSON): MathJSON =>
  equals(
    [
      "Fold",
      [
        "Function",
        ["If", ["LessEqual", "w", 0], "w", ["If", equals("w", i), 0, ["If", less("w", i), -1, at("w")]]],
        "w",
        "k",
      ],
      at(i),
      steps,
    ],
    0,
  );

/** The length of i's cycle: walking from i, on getting back to i at step k the marker is -k. */
const cycleLengthAt = (i: MathJSON): MathJSON => [
  "Negate",
  [
    "Fold",
    ["Function", ["If", ["LessEqual", "w", 0], "w", ["If", equals(at("w"), i), ["Negate", "k"], at("w")]], "w", "k"],
    i,
    steps,
  ],
];

/** Positions that lead their own cycle, one per cycle. */
const cycleLeaders: MathJSON = where(["Range", 1, length(), 1], leads("i"));
/** Each cycle's length, one per cycle. */
const cycleLengths: MathJSON = forEach(cycleLeaders, cycleLengthAt("i"));
/** How many cycles have length `size`. */
const cyclesOfLength = (size: number): MathJSON => count(cycleLengths, equals("c", size), "c");

// Patience sorting, as a fold carrying a GROWING accumulator.
//
// The pile tops stay increasing, so for each entry the pile to replace is the first top that
// is at least as large — which is `(how many tops are smaller) + 1`. If that runs off the
// end, the entry starts a new pile. The number of piles is the length of a longest increasing
// subsequence.
//
// Two things make this expressible, both of which an earlier version of this package
// asserted were impossible:
//
//   - a `Fold` accumulator can GROW. `Join(a, List(b))` appends, and the accumulator can be a
//     list of lists. There is no fixed-width limit.
//   - the pile to replace is found once per entry, then replaced with `ReplaceAt`. Finding it
//     reads the piles inside a lambda, which keeps the compiled fold copying them (one native
//     copy per entry) rather than updating in place.
const piles = (ahead: MathJSON): MathJSON => {
  const target: MathJSON = ["Add", ["Count", ["Filter", "a", ["Function", ahead, "t"]]], 1];
  const step: MathJSON = [
    "If",
    ["Greater", "k", ["Count", "a"]],
    ["Join", "a", ["List", visiting]],
    ["ReplaceAt", "a", "k", visiting],
  ];
  return fold(x, ["List"], ["Apply", ["Function", step, "k"], target]);
};

export const PERMUTATION_STATISTICS: readonly Definition[] = [
  word("Descents", "Positions i with p(i) > p(i+1).", hasPair(count(adjacent, fallsAfter))),
  word("Ascents", "Positions i with p(i) < p(i+1).", hasPair(count(adjacent, risesAfter))),

  word(
    "MajorIndex",
    "The SUM of the descent positions — not their count.",
    hasPair(["Sum", where(adjacent, fallsAfter)]),
    "The distinction from Descents is the entire content of the statistic.",
  ),
  word(
    "MinorIndex",
    "The sum of the ascent positions (the comajor index).",
    hasPair(["Sum", where(adjacent, risesAfter)]),
  ),

  word("Inversions", "Pairs i < j with p(i) > p(j).", hasPair(inversions)),
  stat(
    "Sign",
    "The sign of p: +1 when the inversion count is even, -1 when odd.",
    hasPair(["Power", -1, inversions], 1),
  ),

  stat("FixedPoints", "Positions with p(i) = i.", nonEmpty(count(positions, equals(here, "i")))),
  stat("Excedances", "Positions with p(i) > i.", nonEmpty(count(positions, greater(here, "i")))),
  stat("WeakExceedances", "Positions with p(i) >= i.", nonEmpty(count(positions, atLeastValue(here, "i")))),
  stat("Antiexcedances", "Positions with p(i) < i.", nonEmpty(count(positions, less(here, "i")))),

  stat(
    "Denert",
    "Sum of the excedance positions, plus the inversions within each of the excedance and non-excedance subwords.",
    denert,
    "Foata–Zeilberger's den (FindStat St000156). Mahonian, and (Excedances, Denert) is equidistributed with (Descents, MajorIndex) — checked in tests/permutation.test.ts. Moved off the frontier: it needs no fold, just same-block inversion counting.",
  ),

  word(
    "Peaks",
    "Interior positions with p(i-1) < p(i) > p(i+1).",
    hasTriple(count(interior, and(less(previous, here), greater(here, next)))),
  ),
  word(
    "Valleys",
    "Interior positions with p(i-1) > p(i) < p(i+1).",
    hasTriple(count(interior, and(greater(previous, here), less(here, next)))),
  ),

  word(
    "LeftToRightMaxima",
    "Positions larger than everything before them.",
    nonEmpty(count(positions, equals(here, max(upToHere)))),
    "Also called records.",
  ),
  word(
    "LeftToRightMinima",
    "Positions smaller than everything before them.",
    nonEmpty(count(positions, equals(here, min(upToHere)))),
  ),
  word(
    "RightToLeftMaxima",
    "Positions larger than everything after them.",
    nonEmpty(count(positions, equals(here, max(fromHere)))),
  ),
  word(
    "RightToLeftMinima",
    "Positions smaller than everything after them.",
    nonEmpty(count(positions, equals(here, min(fromHere)))),
  ),

  word(
    "FirstDescent",
    "The smallest descent position, or 0 when p is increasing.",
    hasPair(["If", equals(count(adjacent, fallsAfter), 0), 0, ["Min", where(adjacent, fallsAfter)]]),
  ),
  word(
    "LastDescent",
    "The largest descent position, or 0 when p is increasing.",
    hasPair(["If", equals(count(adjacent, fallsAfter), 0), 0, ["Max", where(adjacent, fallsAfter)]]),
  ),

  word(
    "Runs",
    "Maximal increasing runs — one more than the number of descents.",
    nonEmpty(["Add", hasPair(count(adjacent, fallsAfter)), 1]),
  ),

  stat(
    "Depth",
    "Half the total displacement, (1/2) * sum |p(i) - i|.",
    nonEmpty(["Divide", sumOver(positions, distance(here, "i")), 2]),
  ),

  word(
    "CyclicDescents",
    "Descents of p read cyclically, counting position n when p(n) > p(1).",
    hasPair(["Add", count(adjacent, fallsAfter), ["If", greater(at(length()), at(1)), 1, 0]]),
  ),

  word(
    "OccurrencesOf123",
    "Triples i < j < k with p(i) < p(j) < p(k).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(less(at(i), at(j)), less(at(j), at(k))))),
  ),
  word(
    "OccurrencesOf132",
    "Triples i < j < k with p(i) < p(k) < p(j).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(less(at(i), at(k)), less(at(k), at(j))))),
  ),
  word(
    "OccurrencesOf213",
    "Triples i < j < k with p(j) < p(i) < p(k).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(less(at(j), at(i)), less(at(i), at(k))))),
  ),
  word(
    "StackSortable",
    "1 when p avoids the pattern 231, 0 otherwise — exactly the stack-sortable permutations.",
    hasTriple(
      [
        "If",
        equals(
          occurrencesOfPattern((i, j, k) => and(less(at(k), at(i)), less(at(i), at(j)))),
          0,
        ),
        1,
        0,
      ],
      1,
    ),
  ),

  word(
    "LongestRun",
    "The length of the longest run of consecutive increases.",
    nonEmpty(longestIncreasingRun),
    "Expressed with Fold — which compute-engine does have, contrary to what an earlier version of this package claimed when it put this statistic on the frontier.",
  ),
  word(
    "LargestRunLength",
    "The length of the longest increasing run (the catalog's second spelling of LongestRun).",
    nonEmpty(longestIncreasingRun),
  ),

  stat("CycleCount", "The number of cycles in the disjoint-cycle decomposition.", nonEmpty(["Count", cycleLeaders])),
  stat(
    "ReflectionLength",
    "n minus the number of cycles — the minimum number of transpositions.",
    nonEmpty(subtract(length(), ["Count", cycleLeaders])),
  ),
  stat("LargestCycleLength", "The size of the largest cycle.", nonEmpty(["Max", cycleLengths])),
  stat(
    "LongestCycleLength",
    "The size of the largest cycle (the catalog's second spelling).",
    nonEmpty(["Max", cycleLengths]),
  ),
  stat(
    "DistinctCycleLengths",
    "How many distinct cycle sizes occur.",
    // The lengths 1..n that some cycle has.
    nonEmpty(count(["Range", 1, length(), 1], ["Greater", count(cycleLengths, equals("c", "m"), "c"), 0], "m")),
  ),
  stat("TwoCycleCount", "Cycles of size exactly two.", nonEmpty(cyclesOfLength(2))),
  stat("ThreeCycleCount", "Cycles of size exactly three.", nonEmpty(cyclesOfLength(3))),
  stat(
    "PermutationOrder",
    "The order of p in the symmetric group — the lcm of its cycle lengths.",
    // Spelled LCM, not Lcm — compute-engine uses all-caps for this one and TitleCase for
    // Max/Min/Mod, which is the naming incoherence upstreaming.md §3.5 is about.
    // It also takes arguments rather than a list, so the lcm of a computed list is a fold.
    nonEmpty(fold(cycleLengths, 1, ["LCM", "a", "b"]), 1),
    "Wolfram's PermutationOrder. The bare `Order` is Wolfram's canonical-ordering comparison `Order[a, b]`, so this head replaces it. The old name is recorded in `formerly` but does not resolve: `Order(p)` is now Wolfram's `Order`.",
  ),

  // The moved points, as Wolfram reads them: positions where p(i) differs from i.
  stat(
    "PermutationLength",
    "The number of points p moves.",
    nonEmpty(count(positions, greater(distance(here, "i"), 0))),
  ),
  stat(
    "PermutationSupport",
    "The points p moves, in increasing order.",
    nonEmpty(
      fold(positions, ["List"], ["If", greater(distance(at("b"), "b"), 0), ["Join", "a", ["List", visiting]], "a"]),
      ["List"],
    ),
    undefined,
    "list<integer>",
  ),
  stat(
    "PermutationMax",
    "The largest point p moves; 0 for the identity.",
    nonEmpty(max(forEach(positions, ["If", greater(distance(here, "i"), 0), "i", 0]))),
  ),
  stat(
    "PermutationMin",
    "The smallest point p moves; infinity for the identity.",
    // A numeric infinity: the compiled code has no symbol for it.
    nonEmpty(min(forEach(positions, ["If", greater(distance(here, "i"), 0), "i", INFINITY])), INFINITY),
  ),

  word(
    "LongestIncreasingSubsequence",
    "The length of a longest increasing subsequence.",
    nonEmpty(["Count", piles(["Less", "t", visiting])]),
    "By patience sorting: the number of piles. Checked against the piles algorithm over every permutation of 1..6.",
  ),
  word(
    "LongestDecreasingSubsequence",
    "The length of a longest decreasing subsequence.",
    nonEmpty(["Count", piles(["Greater", "t", visiting])]),
    "The same fold with the comparison reversed — by Dilworth, the number of piles when the tops are kept decreasing.",
  ),
];
