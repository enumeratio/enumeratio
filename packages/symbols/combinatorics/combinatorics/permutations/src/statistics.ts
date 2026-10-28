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
  bind,
  count,
  distance,
  equals,
  fallsAfter,
  fromHere,
  greater,
  hasPair,
  atLeast,
  hasTriple,
  here,
  interior,
  length,
  less,
  max,
  min,
  next,
  or,
  nonEmpty,
  positions,
  previous,
  slice,
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

/** Where the walk from p(i) ends: back at i (marker 0) before it meets anything smaller (marker -1). */
const leadMarker = (i: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    ["If", ["LessEqual", "w", 0], "w", ["If", equals("w", i), 0, ["If", less("w", i), -1, at("w")]]],
    "w",
    "k",
  ],
  at(i),
  steps,
];
/** Whether i leads its cycle: the walk gets back to i before it meets anything smaller. */
const leads = (i: MathJSON): MathJSON => equals(leadMarker(i), 0);

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

/** Peaks of the word `w` (interior positions only); needs at least three letters. */
const peaksOfWord = (w: MathJSON): MathJSON =>
  bind(
    "w",
    w,
    count(
      ["Range", 2, subtract(length("w"), 1)],
      and(less(at(subtract("i", 1), "w"), at("i", "w")), greater(at("i", "w"), at(add("i", 1), "w"))),
    ),
  );
/** The word 0 p(1) ... p(n) / p(1) ... p(n) 0: a zero stands in for the boundary. */
const zeroThen: MathJSON = ["Join", ["List", 0], x];
const thenZero: MathJSON = ["Join", x, ["List", 0]];

/** Whether position k is NOT a descent: an ascent, or off the ends. */
const noDescentAt = (k: MathJSON): MathJSON => [
  "If",
  and(atLeastValue(k, 1), atMostValue(k, subtract(length(), 1))),
  less(at(k), at(add(k, 1))),
  "True",
];

/** m! for m >= 0 (`Range(1, 0)` counts down, so 0 and 1 are stated). */
const factorial = (m: MathJSON): MathJSON => ["If", less(m, 2), 1, ["Product", ["Range", 1, m]]];

/** The position of the value v. */
const positionOf = (v: MathJSON): MathJSON => sumOver(positions, ["If", equals(at("j"), v), "j", 0], "j");

/** The sum of `body` over the pairs i < j with p(i) > p(j) and `also` true of them. */
const sumOverInversions = (body: MathJSON, also: MathJSON = "True"): MathJSON =>
  sumOver(adjacent, [
    "Sum",
    forEach(where(["Range", add("i", 1), length()], and(greater(here, at("j")), also), "j"), body, "j"),
  ]);

// FindStat's other permutation statistics, named after their descriptions.
const FINDSTAT_PERMUTATION_STATISTICS: readonly Definition[] = [
  // Peaks counted against a zero boundary.
  word(
    "LeftOuterPeaks",
    "Peaks of the word 0 p(1) ... p(n): the interior peaks, plus one when p(1) > p(2).",
    hasPair(peaksOfWord(zeroThen)),
  ),
  word(
    "RightOuterPeaks",
    "Peaks of the word p(1) ... p(n) 0: the interior peaks, plus one when p(n) > p(n-1).",
    hasPair(peaksOfWord(thenZero)),
  ),
  word(
    "OuterPeaks",
    "Peaks of the word 0 p(1) ... p(n) 0: the interior peaks, plus one for each end that is a peak.",
    nonEmpty(peaksOfWord(["Join", zeroThen, ["List", 0]])),
  ),

  // Descent and ascent variants.
  word(
    "DoubleAscents",
    "Positions i with p(i) < p(i+1) < p(i+2).",
    hasTriple(count(["Range", 1, subtract(length(), 2)], and(less(here, next), less(next, at(add("i", 2)))))),
  ),
  word(
    "DoubleDescents",
    "Positions i with p(i) > p(i+1) > p(i+2).",
    hasTriple(count(["Range", 1, subtract(length(), 2)], and(greater(here, next), greater(next, at(add("i", 2)))))),
  ),
  word(
    "IsolatedDescents",
    "Descents i such that neither i-1 nor i+1 is a descent.",
    hasPair(count(adjacent, and(fallsAfter, and(noDescentAt(subtract("i", 1)), noDescentAt(add("i", 1)))))),
  ),
  word("BigAscents", "Positions i with p(i+1) - p(i) > 1.", hasPair(count(adjacent, greater(subtract(next, here), 1)))),
  word(
    "BigDescents",
    "Positions i with p(i) - p(i+1) > 1.",
    hasPair(count(adjacent, greater(subtract(here, next), 1))),
  ),
  word(
    "DescentTopSum",
    "The sum of the descent tops: p(i) over the descents i.",
    hasPair(["Sum", forEach(where(adjacent, fallsAfter), here)]),
    "Also called the Genocchi descents.",
  ),
  word(
    "DescentBottomSum",
    "The sum of the descent bottoms: p(i+1) over the descents i.",
    hasPair(["Sum", forEach(where(adjacent, fallsAfter), next)]),
  ),
  word(
    "AscentTopSum",
    "The sum of the ascent tops: p(i+1) over the ascents i.",
    hasPair(["Sum", forEach(where(adjacent, risesAfter), next)]),
  ),
  word(
    "AscentBottomSum",
    "The sum of the ascent bottoms: p(i) over the ascents i.",
    hasPair(["Sum", forEach(where(adjacent, risesAfter), here)]),
  ),
  word(
    "ComajorIndex",
    "The sum of n - i over the descents i.",
    hasPair(["Sum", forEach(where(adjacent, fallsAfter), subtract(length(), "i"))]),
    "The major index of the reversed complement of p; not MinorIndex, which sums the ascent positions themselves.",
  ),

  // Cycle type and displacement.
  stat(
    "NontrivialCycles",
    "Cycles of size at least two: the cycles less the fixed points.",
    nonEmpty(count(cycleLengths, greater("c", 1), "c")),
  ),
  stat("ShortestCycleLength", "The size of the smallest cycle.", nonEmpty(min(cycleLengths))),
  stat(
    "ConjugacyClassSize",
    "The number of permutations of the same cycle type: n! over the product of the cycle sizes and the factorials of the multiplicities.",
    nonEmpty(
      [
        "Divide",
        factorial(length()),
        [
          "Multiply",
          ["Product", cycleLengths],
          [
            "Product",
            forEach(steps, bind("f", count(cycleLengths, equals("c", "m"), "c"), factorial("f"), "number"), "m"),
          ],
        ],
      ],
      1,
    ),
  ),
  stat("WeakAntiexcedances", "Positions with p(i) <= i.", nonEmpty(count(positions, atMostValue(here, "i")))),

  // Length-3 patterns.
  word(
    "OccurrencesOf321",
    "Triples i < j < k with p(i) > p(j) > p(k).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(greater(at(i), at(j)), greater(at(j), at(k))))),
  ),
  word(
    "OccurrencesOf312",
    "Triples i < j < k with p(j) < p(k) < p(i).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(less(at(j), at(k)), less(at(k), at(i))))),
  ),
  word(
    "OccurrencesOf231",
    "Triples i < j < k with p(k) < p(i) < p(j).",
    hasTriple(occurrencesOfPattern((i, j, k) => and(less(at(k), at(i)), less(at(i), at(j))))),
  ),

  // Records.
  word(
    "NonLeftToRightMaxima",
    "Positions smaller than something before them.",
    nonEmpty(count(positions, less(here, max(upToHere)))),
  ),
  word(
    "ExclusiveLeftToRightMaxima",
    "Left-to-right maxima that are not right-to-left minima.",
    nonEmpty(count(positions, and(equals(here, max(upToHere)), greater(here, min(fromHere))))),
  ),
  word(
    "ExclusiveRightToLeftMinima",
    "Right-to-left minima that are not left-to-right maxima.",
    nonEmpty(count(positions, and(equals(here, min(fromHere)), less(here, max(upToHere))))),
  ),
  word(
    "NonRecords",
    "Positions that are none of a left-to-right maximum or minimum, or a right-to-left maximum or minimum.",
    nonEmpty(
      count(
        positions,
        and(
          and(less(here, max(upToHere)), greater(here, min(upToHere))),
          and(less(here, max(fromHere)), greater(here, min(fromHere))),
        ),
      ),
    ),
  ),

  // Inversion variants.
  word(
    "NonInversions",
    "Pairs i < j with p(i) < p(j).",
    hasPair(sumOver(positions, count(["Range", add("i", 1), length()], less(here, at("j")), "j"))),
  ),
  word("InversionSum", "The sum of j - i over the inversions i < j.", hasPair(sumOverInversions(subtract("j", "i")))),
  word(
    "EvenInversions",
    "Inversions i < j with j - i even.",
    hasPair(sumOverInversions(1, equals(["Mod", subtract("j", "i"), 2], 0))),
  ),
  word(
    "OddInversions",
    "Inversions i < j with j - i odd.",
    hasPair(sumOverInversions(1, equals(["Mod", subtract("j", "i"), 2], 1))),
  ),
  stat(
    "InverseMajorIndex",
    "The major index of the inverse: the sum of the values v with v + 1 to the left of v.",
    hasPair(sumOver(adjacent, ["If", greater(positionOf("i"), positionOf(add("i", 1))), "i", 0])),
  ),
];

/** `body` summed over the pairs i < j with `also` true of them (as `sumOverInversions`, for any pair). */
const sumOverPairs = (also: MathJSON, body: MathJSON): MathJSON =>
  sumOver(adjacent, ["Sum", forEach(where(["Range", add("i", 1), length()], also, "j"), body, "j")]);

/** `values` stand in the order `pattern` gives: a chain of `<` through them, smallest first. */
const orderedAs = (pattern: readonly number[], values: readonly MathJSON[]): MathJSON => {
  const byValue = pattern.map((_, position) => position).toSorted((a, b) => pattern[a]! - pattern[b]!);
  return byValue
    .slice(1)
    .map((position, rank) => less(values[byValue[rank]!]!, values[position]!))
    .reduce((all, step) => and(all, step));
};
/** One of several same-length patterns: they cannot both hold, so counting the `or` sums them. */
const orderedAsAny = (patterns: readonly (readonly number[])[], values: readonly MathJSON[]): MathJSON =>
  patterns.map((pattern) => orderedAs(pattern, values)).reduce((any, one) => or(any, one));

/**
 * Occurrences of classical patterns, all of one length (any of `patterns`): increasing position
 * tuples i < j < k < ... whose values stand in the order a pattern gives, over bounded ranges.
 */
const occurrencesOfPatterns = (...patterns: (readonly number[])[]): MathJSON => {
  const size = patterns[0]!.length;
  const names = ["i", "j", "k", "l", "m"].slice(0, size);
  const values = names.map((name) => at(name));
  const n = length();
  const from = (depth: number): MathJSON => (depth === 0 ? 1 : add(names[depth - 1]!, 1));
  const loop = (depth: number): MathJSON =>
    depth === size - 1
      ? count(["Range", from(depth), n], orderedAsAny(patterns, values), names[depth])
      : sumOver(["Range", from(depth), subtract(n, size - 1 - depth)], loop(depth + 1), names[depth]);
  return atLeast(size, loop(0));
};

/** Occurrences of a vincular pattern whose first two entries are adjacent: i, i + 1, then any k > i + 1. */
const occurrencesWithAdjacentStart = (pattern: readonly number[]): MathJSON => {
  const n = length();
  return atLeast(
    3,
    sumOver(
      ["Range", 1, subtract(n, 2)],
      count(["Range", add("i", 2), n], orderedAs(pattern, [at("i"), at(add("i", 1)), at("k")]), "k"),
    ),
  );
};

/** Occurrences whose first entry is p(1), the other two anywhere after it: j < k. */
const occurrencesFromFirstEntry = (pattern: readonly number[]): MathJSON => {
  const n = length();
  return atLeast(
    3,
    sumOver(
      ["Range", 2, subtract(n, 1)],
      count(["Range", add("j", 1), n], orderedAs(pattern, [at(1), at("j"), at("k")]), "k"),
      "j",
    ),
  );
};
/** Occurrences whose first two entries are p(1) and p(2), the third anywhere after them. */
const occurrencesFromFirstTwoEntries = (pattern: readonly number[]): MathJSON =>
  atLeast(3, count(["Range", 3, length()], orderedAs(pattern, [at(1), at(2), at("k")]), "k"));
/** Occurrences whose first entry is p(1), the other two adjacent: j, j + 1. */
const occurrencesFromFirstEntryThenAdjacent = (pattern: readonly number[]): MathJSON =>
  atLeast(3, count(["Range", 2, subtract(length(), 1)], orderedAs(pattern, [at(1), at("j"), at(add("j", 1))]), "j"));
/** Occurrences whose three entries are adjacent: i, i + 1, i + 2. */
const occurrencesOfConsecutivePattern = (pattern: readonly number[]): MathJSON =>
  atLeast(3, count(["Range", 1, subtract(length(), 2)], orderedAs(pattern, [here, next, at(add("i", 2))])));

/** Whether i is a recoil: i + 1 stands to the left of i. */
const isRecoilAt: MathJSON = greater(positionOf("i"), positionOf(add("i", 1)));
/** Big ascents of the word 0 p(1) ... p(n): rises of more than 1, the first entry against 0. */
const bigAscentsFromZero: MathJSON = bind(
  "w",
  zeroThen,
  count(["Range", 1, length("w")], greater(subtract(at(add("i", 1), "w"), at("i", "w")), 1)),
);

// The second batch of FindStat's permutation statistics.
const FINDSTAT_PERMUTATION_STATISTICS_2: readonly Definition[] = [
  // Ends, rises and falls of a fixed size.
  stat("FirstEntry", "The first entry p(1).", nonEmpty(at(1))),
  stat("LastEntry", "The last entry p(n).", nonEmpty(at(length()))),
  word(
    "Successions",
    "Positions i with p(i+1) = p(i) + 1.",
    hasPair(count(adjacent, equals(next, add(here, 1)))),
    "Also called small ascents or 1-rises.",
  ),
  word(
    "Adjacencies",
    "Positions i with p(i+1) = p(i) - 1.",
    hasPair(count(adjacent, equals(next, subtract(here, 1)))),
    "Also called small descents.",
  ),
  word("TwoRises", "Positions i with p(i+1) = p(i) + 2.", hasPair(count(adjacent, equals(next, add(here, 2))))),
  word(
    "MaximalRiseSize",
    "The largest p(i+1) - p(i), or 0 when p has no rise.",
    hasPair(["Max", ["Join", ["List", 0], forEach(adjacent, subtract(next, here))]]),
  ),
  word(
    "BigAscentsAfterPrependingZero",
    "Positions of the word 0 p(1) ... p(n) that rise by more than 1, the first entry counted against 0.",
    nonEmpty(bigAscentsFromZero),
  ),
  word(
    "VeryBigAscents",
    "Positions i with p(i+1) - p(i) > 2.",
    hasPair(count(adjacent, greater(subtract(next, here), 2))),
  ),
  word(
    "VeryBigDescents",
    "Positions i with p(i) - p(i+1) > 2.",
    hasPair(count(adjacent, greater(subtract(here, next), 2))),
  ),

  // Exceedances of a fixed size, and chains of them.
  stat("SmallExcedances", "Positions with p(i) = i + 1.", nonEmpty(count(positions, equals(here, add("i", 1))))),
  stat("TwoExcedances", "Positions with p(i) = i + 2.", nonEmpty(count(positions, equals(here, add("i", 2))))),
  stat("BigExcedances", "Positions with p(i) - i > 1.", nonEmpty(count(positions, greater(subtract(here, "i"), 1)))),
  stat(
    "DoubleExcedances",
    "Positions with i < p(i) < p(p(i)).",
    nonEmpty(count(positions, and(greater(here, "i"), less(here, at(here))))),
  ),
  stat(
    "DoubleDeficiencies",
    "Positions with i > p(i) > p(p(i)).",
    nonEmpty(count(positions, and(less(here, "i"), greater(here, at(here))))),
  ),
  stat(
    "NestedExcedances",
    "Pairs i < j with i < j < p(j) < p(i).",
    hasPair(sumOverPairs(and(less("j", at("j")), less(at("j"), here)), 1)),
  ),
  stat(
    "PureExcedances",
    "Excedances i < p(i) with no j < i where i <= p(j) < p(i).",
    nonEmpty(
      count(
        positions,
        and(
          greater(here, "i"),
          equals(count(["Range", 1, "i"], and(atLeastValue(at("j"), "i"), less(at("j"), here)), "j"), 0),
        ),
      ),
    ),
  ),

  // Splitting the permutation into blocks.
  word(
    "GlobalAscents",
    "Positions i < n with p(j) < p(k) whenever j <= i < k.",
    hasPair(count(adjacent, atMostValue(max(upToHere), "i"))),
    "Read through the pigeonhole principle: the largest of the first i entries is at most i.",
  ),
  word(
    "GlobalDescents",
    "Positions i < n with p(j) > p(k) whenever j <= i < k.",
    hasPair(count(adjacent, greater(min(upToHere), max(slice(add("i", 1), length()))))),
  ),
  stat(
    "DecompositionNumber",
    "The k with {p(1), ..., p(k)} = {1, ..., k}: the blocks of p as a direct sum.",
    nonEmpty(count(positions, equals(max(upToHere), "i"))),
    "One more than GlobalAscents; also called the block number.",
  ),

  // Cycles, distances and sums.
  stat(
    "CyclesOfLengthAtLeastThree",
    "Cycles of size at least three.",
    nonEmpty(count(cycleLengths, atLeastValue("c", 3), "c")),
  ),
  word(
    "InversionsOfDistanceAtMostTwo",
    "Inversions i < j with j - i <= 2.",
    hasPair(sumOverInversions(1, atMostValue(subtract("j", "i"), 2))),
  ),
  word(
    "NonInversionSum",
    "The sum of j - i over the non-inversions i < j.",
    hasPair(sumOverPairs(less(here, at("j")), subtract("j", "i"))),
  ),
  stat("TotalDisplacement", "The sum of |p(i) - i|.", nonEmpty(sumOver(positions, distance(here, "i")))),
  word(
    "DescentDifferenceSum",
    "The sum of p(i) - p(i+1) over the descents i.",
    hasPair(["Sum", forEach(where(adjacent, fallsAfter), subtract(here, next))]),
    "Also called the drop of a permutation.",
  ),
  word(
    "ShiftedMajorIndex",
    "The sum of the positions i with p(i) - p(i+1) >= 2.",
    hasPair(["Sum", where(adjacent, greater(subtract(here, next), 1))]),
  ),
  stat(
    "Recoils",
    "Values i with i + 1 to the left of i: the descents of the inverse.",
    hasPair(count(adjacent, isRecoilAt)),
  ),
  stat(
    "DescentsOrRecoils",
    "Indices i < n that are a descent of p or a recoil.",
    hasPair(count(adjacent, or(fallsAfter, isRecoilAt))),
  ),
  word(
    "LeftToRightMaximaPositionSum",
    "The sum of the positions of the left-to-right maxima.",
    nonEmpty(["Sum", where(positions, equals(here, max(upToHere)))]),
  ),
  word(
    "ArithmeticProgressionsOfLengthTwo",
    "Triples i < j < k with p(k) - p(j) = p(j) - p(i).",
    // Bounded ranges: an equality, unlike an order, holds between two missing entries.
    hasTriple(
      sumOver(
        ["Range", 1, subtract(length(), 2)],
        sumOver(
          ["Range", add("i", 1), subtract(length(), 1)],
          count(["Range", add("j", 1), length()], equals(subtract(at("k"), at("j")), subtract(at("j"), here)), "k"),
          "j",
        ),
      ),
    ),
  ),

  // Length-4 patterns.
  word("OccurrencesOf1324", "Quadruples i < j < k < l ordered as 1324.", occurrencesOfPatterns([1, 3, 2, 4])),
  word("OccurrencesOf2143", "Quadruples i < j < k < l ordered as 2143.", occurrencesOfPatterns([2, 1, 4, 3])),
  word("OccurrencesOf4231", "Quadruples i < j < k < l ordered as 4231.", occurrencesOfPatterns([4, 2, 3, 1])),
  word("OccurrencesOf2413", "Quadruples i < j < k < l ordered as 2413.", occurrencesOfPatterns([2, 4, 1, 3])),
  word("OccurrencesOf1432", "Quadruples i < j < k < l ordered as 1432.", occurrencesOfPatterns([1, 4, 3, 2])),
];

/** The cyclic successor of position i: i + 1, and 1 after the last. */
const cyclicNext: MathJSON = ["If", equals("i", length()), 1, add("i", 1)];
const isSmallExcedance: MathJSON = equals(here, add("i", 1));
const isSmallWeakExcedance: MathJSON = or(equals(here, "i"), isSmallExcedance);
const isCyclicSmallExcedance: MathJSON = equals(here, cyclicNext);
const isCyclicSmallWeakExcedance: MathJSON = or(equals(here, "i"), isCyclicSmallExcedance);
/** The positions that fail `predicate`: all of them, less those that pass. */
const countFailing = (predicate: MathJSON): MathJSON => subtract(length(), count(positions, predicate));

/** A pattern count read off the permutation by `Occurrences...` and a pattern written in FindStat's notation. */
const patternCount = (head: string, shape: string, expr: MathJSON, summary: string, note?: string): Definition =>
  word(head, `${summary} (${shape}).`, expr, note);

// The third batch of FindStat's permutation statistics: vincular and consecutive patterns,
// pattern pairs, and the small-excedance families.
const FINDSTAT_PERMUTATION_STATISTICS_3: readonly Definition[] = [
  // Vincular patterns xy-z: the first two entries adjacent, the third anywhere after.
  patternCount(
    "OccurrencesOf21Dash3",
    "21-3",
    occurrencesWithAdjacentStart([2, 1, 3]),
    "Triples i, i+1, k with k > i+1 ordered as 213",
  ),
  patternCount(
    "OccurrencesOf13Dash2",
    "13-2",
    occurrencesWithAdjacentStart([1, 3, 2]),
    "Triples i, i+1, k with k > i+1 ordered as 132",
  ),
  patternCount(
    "OccurrencesOf12Dash3",
    "12-3",
    occurrencesWithAdjacentStart([1, 2, 3]),
    "Triples i, i+1, k with k > i+1 ordered as 123",
  ),
  patternCount(
    "OccurrencesOf31Dash2",
    "31-2",
    occurrencesWithAdjacentStart([3, 1, 2]),
    "Triples i, i+1, k with k > i+1 ordered as 312",
  ),
  patternCount(
    "OccurrencesOf23Dash1",
    "23-1",
    occurrencesWithAdjacentStart([2, 3, 1]),
    "Triples i, i+1, k with k > i+1 ordered as 231",
  ),
  patternCount(
    "OccurrencesOf32Dash1",
    "32-1",
    occurrencesWithAdjacentStart([3, 2, 1]),
    "Triples i, i+1, k with k > i+1 ordered as 321",
  ),

  // Patterns whose first entry is p(1).
  patternCount(
    "OccurrencesOfInitial213",
    "|213",
    occurrencesFromFirstEntry([2, 1, 3]),
    "Triples 1 < j < k ordered as 213",
  ),
  patternCount(
    "OccurrencesOfInitial231",
    "|231",
    occurrencesFromFirstEntry([2, 3, 1]),
    "Triples 1 < j < k ordered as 231",
  ),
  patternCount(
    "OccurrencesOfInitial312",
    "|312",
    occurrencesFromFirstEntry([3, 1, 2]),
    "Triples 1 < j < k ordered as 312",
  ),
  patternCount(
    "OccurrencesOfInitial321",
    "|321",
    occurrencesFromFirstEntry([3, 2, 1]),
    "Triples 1 < j < k ordered as 321",
  ),
  patternCount(
    "OccurrencesOfInitial132",
    "|132",
    occurrencesFromFirstEntry([1, 3, 2]),
    "Triples 1 < j < k ordered as 132",
  ),
  patternCount(
    "OccurrencesOfInitial123",
    "|123",
    occurrencesFromFirstEntry([1, 2, 3]),
    "Triples 1 < j < k ordered as 123",
  ),
  patternCount(
    "OccurrencesOfInitial12Dash3",
    "|12-3",
    occurrencesFromFirstTwoEntries([1, 2, 3]),
    "Triples 1, 2, k ordered as 123",
    "FindStat titles this |1-23, but its definition matches p(1) and p(2) as adjacent.",
  ),
  patternCount(
    "OccurrencesOfInitial2Dash13",
    "|2-13",
    occurrencesFromFirstEntryThenAdjacent([2, 1, 3]),
    "Triples 1, j, j+1 ordered as 213",
    "FindStat titles this |21-3.",
  ),
  patternCount(
    "OccurrencesOfInitial1Dash23",
    "|1-23",
    occurrencesFromFirstEntryThenAdjacent([1, 2, 3]),
    "Triples 1, j, j+1 ordered as 123",
    "FindStat titles this |12-3.",
  ),
  patternCount(
    "OccurrencesOfConsecutive132",
    "consecutive 132",
    occurrencesOfConsecutivePattern([1, 3, 2]),
    "Triples i, i+1, i+2 ordered as 132",
  ),

  // More patterns of length 4.
  word("OccurrencesOf3241", "Quadruples i < j < k < l ordered as 3241.", occurrencesOfPatterns([3, 2, 4, 1])),
  word("OccurrencesOf4213", "Quadruples i < j < k < l ordered as 4213.", occurrencesOfPatterns([4, 2, 1, 3])),

  // Pairs and triples of patterns, counted together.
  word("OccurrencesOf123Or132", "Triples ordered as 123 or as 132.", occurrencesOfPatterns([1, 2, 3], [1, 3, 2])),
  word("OccurrencesOf213Or321", "Triples ordered as 213 or as 321.", occurrencesOfPatterns([2, 1, 3], [3, 2, 1])),
  word("OccurrencesOf132Or321", "Triples ordered as 132 or as 321.", occurrencesOfPatterns([1, 3, 2], [3, 2, 1])),
  word(
    "OccurrencesOf132Or213Or321",
    "Triples ordered as 132, 213 or 321.",
    occurrencesOfPatterns([1, 3, 2], [2, 1, 3], [3, 2, 1]),
    "Studied by Gepner in conformal field theory.",
  ),
  word(
    "OccurrencesOf3241Or4231",
    "Quadruples ordered as 3241 or as 4231.",
    occurrencesOfPatterns([3, 2, 4, 1], [4, 2, 3, 1]),
    "A permutation avoids both exactly when it is an input-restricted deque.",
  ),
  word(
    "OccurrencesOf4132Or4231",
    "Quadruples ordered as 4132 or as 4231.",
    occurrencesOfPatterns([4, 1, 3, 2], [4, 2, 3, 1]),
  ),
  word(
    "OccurrencesOf3412Or4231",
    "Quadruples ordered as 3412 or as 4231.",
    occurrencesOfPatterns([3, 4, 1, 2], [4, 2, 3, 1]),
    "A permutation avoids both exactly when its Schubert variety is smooth.",
  ),
  word(
    "OccurrencesOf2143Or4213",
    "Quadruples ordered as 2143 or as 4213.",
    occurrencesOfPatterns([2, 1, 4, 3], [4, 2, 1, 3]),
  ),

  // Small excedances, with and without the weak and cyclic variants.
  stat(
    "SmallWeakExcedances",
    "Positions with p(i) = i or p(i) = i + 1.",
    nonEmpty(count(positions, isSmallWeakExcedance)),
  ),
  stat("NonSmallExcedances", "Positions with p(i) != i + 1.", nonEmpty(countFailing(isSmallExcedance))),
  stat(
    "NonSmallWeakExcedances",
    "Positions with p(i) not in {i, i + 1}.",
    nonEmpty(countFailing(isSmallWeakExcedance)),
  ),
  stat(
    "CyclicSmallExcedances",
    "Positions with p(i) = i + 1, read cyclically: the last position counts when p(n) = 1.",
    nonEmpty(count(positions, isCyclicSmallExcedance)),
  ),
  stat(
    "CyclicSmallWeakExcedances",
    "Positions with p(i) = i or p(i) = i + 1, read cyclically.",
    nonEmpty(count(positions, isCyclicSmallWeakExcedance)),
  ),
  stat(
    "NonCyclicSmallExcedances",
    "Positions that are not cyclic small excedances.",
    nonEmpty(countFailing(isCyclicSmallExcedance)),
  ),
  stat(
    "NonCyclicSmallWeakExcedances",
    "Positions that are not cyclic small weak excedances.",
    nonEmpty(countFailing(isCyclicSmallWeakExcedance)),
  ),
];

const majorIndexOfWord: MathJSON = ["Sum", where(adjacent, fallsAfter)];
/** Positions i with p(i) and p(i + distance) related by `relation`. */
const pairsAtDistance = (distanceApart: number, relation: (a: MathJSON, b: MathJSON) => MathJSON): MathJSON =>
  atLeast(
    distanceApart + 1,
    count(["Range", 1, subtract(length(), distanceApart)], relation(here, at(add("i", distanceApart)))),
  );
/** Descents i, counted when i itself satisfies `parity` (0 for even, 1 for odd). */
const descentsAtParity = (parity: number): MathJSON =>
  hasPair(count(adjacent, and(fallsAfter, equals(["Mod", "i", 2], parity))));
const isLeftToRightMaximum: MathJSON = equals(here, max(upToHere));
const isRightToLeftMinimum: MathJSON = equals(here, min(fromHere));

// The fourth batch: the rest of the pattern pairs, length-5 patterns, and more fixed-size
// excedances, rises and displacements.
const FINDSTAT_PERMUTATION_STATISTICS_4: readonly Definition[] = [
  // Pairs of length-3 patterns, counted together.
  word("OccurrencesOf132Or231", "Triples ordered as 132 or as 231.", occurrencesOfPatterns([1, 3, 2], [2, 3, 1])),
  word("OccurrencesOf132Or213", "Triples ordered as 132 or as 213.", occurrencesOfPatterns([1, 3, 2], [2, 1, 3])),
  word("OccurrencesOf132Or312", "Triples ordered as 132 or as 312.", occurrencesOfPatterns([1, 3, 2], [3, 1, 2])),
  word("OccurrencesOf123Or231", "Triples ordered as 123 or as 231.", occurrencesOfPatterns([1, 2, 3], [2, 3, 1])),
  word("OccurrencesOf123Or213", "Triples ordered as 123 or as 213.", occurrencesOfPatterns([1, 2, 3], [2, 1, 3])),
  word("OccurrencesOf123Or321", "Triples ordered as 123 or as 321.", occurrencesOfPatterns([1, 2, 3], [3, 2, 1])),
  word("OccurrencesOf123Or312", "Triples ordered as 123 or as 312.", occurrencesOfPatterns([1, 2, 3], [3, 1, 2])),
  word("OccurrencesOf231Or312", "Triples ordered as 231 or as 312.", occurrencesOfPatterns([2, 3, 1], [3, 1, 2])),
  word("OccurrencesOf213Or312", "Triples ordered as 213 or as 312.", occurrencesOfPatterns([2, 1, 3], [3, 1, 2])),
  word("OccurrencesOf213Or231", "Triples ordered as 213 or as 231.", occurrencesOfPatterns([2, 1, 3], [2, 3, 1])),
  word("OccurrencesOf231Or321", "Triples ordered as 231 or as 321.", occurrencesOfPatterns([2, 3, 1], [3, 2, 1])),
  word("OccurrencesOf312Or321", "Triples ordered as 312 or as 321.", occurrencesOfPatterns([3, 1, 2], [3, 2, 1])),
  // Patterns of different lengths add: an occurrence of one is not an occurrence of the other.
  word(
    "OccurrencesOf321Or3412",
    "Triples ordered as 321, plus quadruples ordered as 3412.",
    add(occurrencesOfPatterns([3, 2, 1]), occurrencesOfPatterns([3, 4, 1, 2])),
    "A permutation avoids both exactly when it is boolean: its Bruhat interval below is a boolean lattice.",
  ),

  // Length-5 patterns.
  word(
    "OccurrencesOf52341",
    "Quintuples i < j < k < l < m ordered as 52341.",
    occurrencesOfPatterns([5, 2, 3, 4, 1]),
    "Avoiding it is necessary for the Schubert variety to have a complete parabolic bundle structure.",
  ),
  word(
    "OccurrencesOf41352Or42351Or51342Or52341",
    "Quintuples ordered as 41352, 42351, 51342 or 52341.",
    occurrencesOfPatterns([4, 1, 3, 5, 2], [4, 2, 3, 5, 1], [5, 1, 3, 4, 2], [5, 2, 3, 4, 1]),
  ),

  // Fixed-size excedances, deficiencies, rises and distance-two steps.
  stat("ThreeExcedances", "Positions with p(i) = i + 3.", nonEmpty(count(positions, equals(here, add("i", 3))))),
  word("ThreeRises", "Positions i with p(i+1) = p(i) + 3.", hasPair(count(adjacent, equals(next, add(here, 3))))),
  stat("BigDeficiencies", "Positions with i - p(i) > 1.", nonEmpty(count(positions, greater(subtract("i", here), 1)))),
  word("DescentsOfDistanceTwo", "Positions i with p(i) > p(i+2).", pairsAtDistance(2, greater)),
  word("AscentsOfDistanceTwo", "Positions i with p(i) < p(i+2).", pairsAtDistance(2, less)),
  word(
    "DoubleSuccessions",
    "Positions i with p(i+1) = p(i) + 1 and p(i+2) = p(i) + 2.",
    hasTriple(
      count(
        ["Range", 1, subtract(length(), 2)],
        and(equals(next, add(here, 1)), equals(at(add("i", 2)), add(here, 2))),
      ),
    ),
  ),

  // Descents against recoils, and descents by parity.
  stat(
    "DescentsPlusRecoils",
    "Descents plus recoils: the two counts added, not the union of the indices.",
    hasPair(add(count(adjacent, fallsAfter), count(adjacent, isRecoilAt))),
  ),
  stat(
    "DescentsAndRecoils",
    "Indices i < n that are both a descent of p and a recoil.",
    hasPair(count(adjacent, and(fallsAfter, isRecoilAt))),
  ),
  word("OddDescents", "Descents i with i odd.", descentsAtParity(1)),
  word("EvenDescents", "Descents i with i even.", descentsAtParity(0)),
  word(
    "FinalRises",
    "The ascents at the end: n - 1 less the last descent position.",
    hasPair(
      subtract(subtract(length(), 1), [
        "If",
        equals(count(adjacent, fallsAfter), 0),
        0,
        ["Max", where(adjacent, fallsAfter)],
      ]),
    ),
  ),

  // Records and middles of triples.
  word(
    "MidPointsOfOccurrencesOf321",
    "Positions that are the middle of a 321 occurrence: neither a left-to-right maximum nor a right-to-left minimum.",
    nonEmpty(count(positions, and(less(here, max(upToHere)), greater(here, min(fromHere))))),
  ),
  word(
    "MidPointsOfOccurrencesOf123",
    "Positions that are the middle of a 123 occurrence.",
    nonEmpty(count(positions, and(greater(here, min(upToHere)), less(here, max(fromHere))))),
  ),
  word(
    "LeftToRightMaximaOrRightToLeftMinima",
    "Positions that are a left-to-right maximum, a right-to-left minimum, or both.",
    nonEmpty(count(positions, or(isLeftToRightMaximum, isRightToLeftMinimum))),
  ),

  // Combinations of the major index with inversions and excedances.
  word(
    "MajorIndexMinusInversions",
    "The major index less the number of inversions.",
    hasPair(subtract(majorIndexOfWord, inversions)),
  ),
  word(
    "InversionsPlusMajorIndex",
    "The number of inversions plus the major index.",
    hasPair(add(inversions, majorIndexOfWord)),
  ),
  stat(
    "MajorIndexMinusExcedances",
    "The major index less the number of positions with p(i) > i.",
    hasPair(subtract(majorIndexOfWord, count(positions, greater(here, "i")))),
  ),

  stat("MaximalDisplacement", "The largest |p(i) - i|.", nonEmpty(max(forEach(positions, distance(here, "i"))))),
];

/** `from .. to`, empty when `to < from` (a bare `Range` would count down). */
const span = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
/** The word with each fixed point replaced by 0 (Foata–Han's zeroing). */
const fixedPointsZeroed: MathJSON = forEach(positions, ["If", equals(here, "i"), 0, here]);
/** The descents of the zeroed word, then its major index. */
const zeroedDescents = (body: MathJSON): MathJSON =>
  hasPair(
    bind("w", fixedPointsZeroed, [
      "Sum",
      forEach(where(span(1, subtract(length("w"), 1)), greater(at("i", "w"), at(add("i", 1), "w"))), body),
    ]),
  );

/** Whether i is the smallest point of a run of consecutive values, one position apart: no earlier succession. */
const startsSuccessionRun: MathJSON = [
  "If",
  equals("i", 1),
  "True",
  or(less(here, add(previous, 1)), greater(here, add(previous, 1))),
];

/** Whether position i is the middle of a 321 occurrence: something larger before, something smaller after. */
const isMiddleOf321: MathJSON = and(less(here, max(upToHere)), greater(here, min(fromHere)));

/** The values at the breakpoints: k such that p(1..k) is a permutation of 1..k. */
const breakpoints: MathJSON = where(positions, equals(max(upToHere), "i"));

/** Whether the value at position i sits to the left of the value one less: a drop in the inverse. */
const inverseMajorIndex: MathJSON = sumOver(adjacent, [
  "If",
  greater(positionOf("i"), positionOf(add("i", 1))),
  "i",
  0,
]);

/** Selection sort swapping n into place, then n-1, ...: the total distance the entries travel (Petersen). */
const sortingIndex: MathJSON = [
  "At",
  fold(
    ["Range", length(), 1, -1],
    ["List", 0, x],
    [
      "Apply",
      [
        "Function",
        [
          "List",
          add(carried(1), subtract(visiting, "t")),
          ["ReplaceAt", ["ReplaceAt", carried(2), "t", at(visiting, carried(2))], visiting, visiting],
        ],
        "t",
      ],
      ["Sum", forEach(positions, ["If", equals(at("j", carried(2)), visiting), "j", 0], "j")],
    ],
  ),
  1,
];

/** The cycles whose smallest point is a, written a, p(a), p(p(a)), ...: a descent is a step down that does not close the cycle. */
const cycleDescents: MathJSON = count(positions, and(less(here, "i"), less(leadMarker(here), 0)));

/** Elizalde–Pak: the largest k with p(i) > k for every i <= k, read as the first k that fails less one. */
const elizaldePakRank: MathJSON = count(
  positions,
  equals(count(span(1, "k"), atMostValue(min(slice(1, "m")), "m"), "m"), 0),
  "k",
);

/** Positions where the entries seen so far, in the order of the scan, leave `i` unremoved: Disorder, value by value. */
const disorder: MathJSON = sumOver(
  span(1, subtract(length(), 1)),
  bind(
    "a",
    positionOf(subtract("v", 1)),
    bind(
      "b",
      positionOf("v"),
      count(
        positions,
        and(
          greater(at("q"), "v"),
          or(
            and(less("a", "b"), and(greater("q", "a"), less("q", "b"))),
            and(greater("a", "b"), or(greater("q", "a"), less("q", "b"))),
          ),
        ),
        "q",
      ),
      "number",
    ),
    "number",
  ),
  "v",
);

/** Positions a with the value p(a) - 1 to the right of a, and a larger entry in between. */
const tier: MathJSON = count(
  positions,
  and(
    greater(positionOf(subtract(here, 1)), "i"),
    greater(count(span(add("i", 1), subtract(positionOf(subtract(here, 1)), 1)), greater(at("b"), here), "b"), 0),
  ),
);

// The fifth batch: cycle, record and displacement statistics from the crawl that the earlier
// batches left, and the fixed-point zeroing family.
const FINDSTAT_PERMUTATION_STATISTICS_5: readonly Definition[] = [
  stat(
    "ValleysIncludingBoundary",
    "Positions lower than both neighbours, a larger entry standing off each end.",
    nonEmpty(
      count(
        positions,
        and(
          ["If", equals("i", 1), "True", greater(previous, here)],
          ["If", equals("i", length()), "True", less(here, next)],
        ),
      ),
    ),
    "Excluding the boundary is Valleys.",
  ),
  stat(
    "MaximalExcedance",
    "The largest p(i) - i.",
    nonEmpty(max(forEach(positions, subtract(here, "i")))),
    "FindStat's title says drop size, i - p(i); its code takes p(i) - i. This follows the code.",
  ),
  stat(
    "AdjacentCycles",
    "Cycles of the form (a, a+1, ..., a+k), fixed points included.",
    nonEmpty(
      count(
        positions,
        greater(
          count(
            span("i", length()),
            and(
              equals(at("m"), "i"),
              equals(
                count(
                  span("i", length()),
                  and(less("j", "m"), or(less(at("j"), add("j", 1)), greater(at("j"), add("j", 1)))),
                  "j",
                ),
                0,
              ),
            ),
            "m",
          ),
          0,
        ),
      ),
    ),
  ),
  word(
    "StrongFixedPoints",
    "Positions that are both a left-to-right maximum and a right-to-left minimum.",
    nonEmpty(count(positions, and(isLeftToRightMaximum, isRightToLeftMinimum))),
  ),
  stat(
    "SortingIndex",
    "The total distance the entries move in selection sort.",
    nonEmpty(sortingIndex),
    "Selection sort swaps n into place, then n - 1, and so on; the fold carries the total and the word.",
  ),
  stat(
    "Load",
    "The major index of the reverse of the inverse.",
    hasPair(sumOver(adjacent, ["If", less(positionOf("i"), positionOf(add("i", 1))), subtract(length(), "i"), 0])),
  ),
  stat("CycleDescents", "Steps down within the cycles, each written from its smallest point.", nonEmpty(cycleDescents)),
  stat(
    "DescentsAfterZeroingFixedPoints",
    "The descents of the word with every fixed point replaced by 0.",
    zeroedDescents(1),
  ),
  stat(
    "MajorIndexAfterZeroingFixedPoints",
    "The major index of the word with every fixed point replaced by 0.",
    zeroedDescents("i"),
  ),
  stat(
    "ElizaldePakRank",
    "The largest k with p(i) > k for all i <= k.",
    nonEmpty(elizaldePakRank),
    "Read as FindStat's code does: the first k that fails, less one.",
  ),
  stat(
    "Disorder",
    "Scanning cyclically for 1, then 2, ...: the entries passed that are still larger than the one sought.",
    hasPair(disorder),
  ),
  stat(
    "CyclesOfLengthAtMostTwo",
    "Cycles of size one or two.",
    nonEmpty(count(cycleLengths, atMostValue("c", 2), "c")),
  ),
  stat(
    "CyclesOfLengthAtMostThree",
    "Cycles of size at most three.",
    nonEmpty(count(cycleLengths, atMostValue("c", 3), "c")),
  ),
  word(
    "InversionsOfDistanceAtMostThree",
    "Inversions i < j with j - i <= 3.",
    hasPair(sumOverInversions(1, atMostValue(subtract("j", "i"), 3))),
  ),
  stat("FirstDirectSummandSize", "The smallest k with {p(1), ..., p(k)} = {1, ..., k}.", nonEmpty(min(breakpoints))),
  stat(
    "LargestDirectSummandSize",
    "The size of the largest block of p as a direct sum.",
    nonEmpty(
      bind(
        "b",
        ["Join", ["List", 0], breakpoints],
        max(forEach(span(1, subtract(length("b"), 1)), subtract(at(add("i", 1), "b"), at("i", "b")))),
      ),
    ),
  ),
  stat(
    "StretchingPairs",
    "Pairs i < j with p(i) < i < j < p(j).",
    hasPair(sumOverPairs(and(less(here, "i"), less("j", at("j"))), 1)),
  ),
  word(
    "InversionIndex",
    "The sum of the larger entry p(i) over the inversions i < j.",
    hasPair(sumOverInversions(here)),
  ),
  stat(
    "TotalSquaredDisplacement",
    "The sum of (p(i) - i)^2.",
    nonEmpty(sumOver(positions, ["Power", subtract(here, "i"), 2])),
    "Twice InversionSum, though neither definition shows it. FindStat calls it Spearman's rho of p against the identity.",
  ),
  word(
    "LeftToRightMaximaXorRightToLeftMinima",
    "Positions that are a left-to-right maximum or a right-to-left minimum but not both.",
    nonEmpty(
      count(
        positions,
        or(
          and(isLeftToRightMaximum, greater(here, min(fromHere))),
          and(isRightToLeftMinimum, less(here, max(upToHere))),
        ),
      ),
    ),
  ),
  word(
    "MaximalSuccessiveDifference",
    "The largest p(i+1) - p(i), negative for a decreasing permutation.",
    hasPair(max(forEach(adjacent, subtract(next, here)))),
    "MaximalRiseSize is the same with a floor of 0.",
  ),
  stat(
    "MajorIndexPlusInverseMajorIndex",
    "The major index plus the major index of the inverse.",
    hasPair(add(majorIndexOfWord, inverseMajorIndex)),
  ),
  stat("Tier", "Positions a with a larger entry, then the value p(a) - 1, to its right.", nonEmpty(tier)),
  word(
    "Rafts",
    "Maximal runs of consecutive successions p(i+1) = p(i) + 1.",
    hasPair(count(adjacent, and(equals(next, add(here, 1)), startsSuccessionRun))),
  ),
  stat(
    "WeakExcedanceMidPointsOfOccurrencesOf321",
    "Positions i with p(i) >= i that are the middle of a 321 occurrence.",
    nonEmpty(count(positions, and(atLeastValue(here, "i"), isMiddleOf321))),
  ),
  stat(
    "NonWeakExcedanceMidPointsOfOccurrencesOf321",
    "Positions i with p(i) < i that are the middle of a 321 occurrence.",
    nonEmpty(count(positions, and(less(here, "i"), isMiddleOf321))),
  ),
  word(
    "TwoShiftedMajorIndex",
    "The sum of the positions i with p(i) - p(i+1) > 2.",
    hasPair(["Sum", where(adjacent, greater(subtract(here, next), 2))]),
    "ShiftedMajorIndex is the same with a gap of more than 1.",
  ),
  word(
    "ThreeShiftedMajorIndex",
    "The sum of the positions i with p(i) - p(i+1) > 3.",
    hasPair(["Sum", where(adjacent, greater(subtract(here, next), 3))]),
  ),
  word(
    "PinnacleSum",
    "The sum of the peak values: p(i) over the interior peaks i.",
    hasTriple(["Sum", forEach(where(interior, and(less(previous, here), greater(here, next))), here)]),
  ),
  word(
    "AugmentedDoubleAscents",
    "Positions i with w(i) < w(i+1) < w(i+2) in the word w = 0 p(1) ... p(n).",
    hasPair(
      bind(
        "w",
        zeroThen,
        count(
          span(1, subtract(length("w"), 2)),
          and(less(at("i", "w"), at(add("i", 1), "w")), less(at(add("i", 1), "w"), at(add("i", 2), "w"))),
        ),
      ),
    ),
  ),
];

/** Step k is inside the word: 1 <= k <= n - 1. */
const isStep = (k: MathJSON): MathJSON => and(atLeastValue(k, 1), atMostValue(k, subtract(length(), 1)));
/** Step k is a small ascent, p(k+1) = p(k) + 1 (false off the ends). */
const smallAscentAt = (k: MathJSON): MathJSON => ["If", isStep(k), equals(at(add(k, 1)), add(at(k), 1)), "False"];
/** Step k is anything but a small ascent (true off the ends). */
const notSmallAscentAt = (k: MathJSON): MathJSON => [
  "If",
  isStep(k),
  or(less(at(add(k, 1)), add(at(k), 1)), greater(at(add(k, 1)), add(at(k), 1))),
  "True",
];
/** Step k is a large ascent, p(k+1) > p(k) + 1 (false off the ends). */
const largeAscentAt = (k: MathJSON): MathJSON => ["If", isStep(k), greater(at(add(k, 1)), add(at(k), 1)), "False"];
/** The steps 1 .. n - 1, empty for a word shorter than two. */
const steps1: MathJSON = span(1, subtract(length(), 1));

/** The interior peaks and valleys: the peaks of the word and of its complement. */
const directionChanges: MathJSON = add(
  peaksOfWord(x),
  peaksOfWord(forEach(positions, subtract(add(length(), 1), here))),
);

/** The gaps |p(i+1) - p(i)|, one per step. */
const jumps: MathJSON = forEach(steps1, distance(next, here));
/** The jumps with the wrap-around gap |p(n) - p(1)|. */
const cyclicJumps: MathJSON = ["Join", jumps, ["List", distance(at(length()), at(1))]];

/** How many positions i have p(i) - i = k: the entries on the diagonal k. */
const diagonalCount = (k: MathJSON): MathJSON => count(positions, equals(subtract(here, "i"), k));

/** The Lehmer code entry at i: later entries smaller than p(i). */
const lehmerCodeAt: MathJSON = count(span(add("i", 1), length()), less(at("j"), here), "j");

/** The pairs (i, j) of positions, in either order, satisfying `cond`, over the arcs i -> p(i) and j -> p(j). */
const arcPairs = (cond: MathJSON): MathJSON => nonEmpty(sumOver(positions, count(positions, cond, "j")));
/** `values[0] < values[1] < ...`, with the links listed in `weak` read as `<=`. */
const chain = (values: readonly MathJSON[], weak: readonly number[] = []): MathJSON =>
  values
    .slice(1)
    .map((v, k) => (weak.includes(k) ? atMostValue(values[k]!, v) : less(values[k]!, v)))
    .reduce((all, link) => and(all, link));
/** p(j), beside `here` = p(i). */
const wordAtJ = at("j");

/** The word p(n) p(1) ... p(n) p(1), whose interior reads p cyclically. */
const cyclicWord: MathJSON = ["Join", ["List", at(length())], x, ["List", at(1)]];

// The sixth batch: jumps, diagonals, rafts and their floats, and the cyclic and visibility variants.
const FINDSTAT_PERMUTATION_STATISTICS_6: readonly Definition[] = [
  word(
    "AlternatingRuns",
    "The interior peaks plus the interior valleys.",
    hasTriple(directionChanges),
    "FindStat's title: the times the word switches from increasing to decreasing or back.",
  ),
  word(
    "UpDownRuns",
    "Maximal monotone runs, with p(1) counted alone when it is a descent.",
    nonEmpty([
      "If",
      less(length(), 2),
      1,
      ["If", greater(at(1), at(2)), add(hasTriple(directionChanges), 2), add(hasTriple(directionChanges), 1)],
    ]),
  ),
  word(
    "NonInitialLeftToRightMinima",
    "Positions i >= 2 with p(i) smaller than everything before it.",
    nonEmpty(count(span(2, length()), less(here, min(slice(1, subtract("i", 1)))))),
    "FindStat's title speaks of indices with all smaller indices to the right; its code counts these, one less than LeftToRightMinima.",
  ),
  word(
    "RightFloats",
    "Large ascents p(i+1) > p(i) + 1 beside no raft.",
    hasPair(
      count(steps1, and(largeAscentAt("i"), and(notSmallAscentAt(subtract("i", 1)), notSmallAscentAt(add("i", 1))))),
    ),
    "Rafts are the maximal runs of successions; a large ascent beside none of them floats.",
  ),
  word(
    "RightRopes",
    "Large ascents right after a raft.",
    hasPair(count(steps1, and(smallAscentAt("i"), largeAscentAt(add("i", 1))))),
  ),
  word(
    "RightTethers",
    "Large ascents between two rafts.",
    hasPair(count(steps1, and(smallAscentAt("i"), and(largeAscentAt(add("i", 1)), smallAscentAt(add("i", 2)))))),
  ),
  word("MinimalJump", "The smallest |p(i+1) - p(i)|.", hasPair(min(jumps))),
  word("MaximalJump", "The largest |p(i+1) - p(i)|.", hasPair(max(jumps))),
  word("CyclicMaximalJump", "The largest |p(i+1) - p(i)|, with p(n+1) = p(1).", nonEmpty(max(cyclicJumps))),
  word(
    "NeighboringNumber",
    "The smallest |p(i+1) - p(i)|, the wrap-around gap |p(1) - p(n)| included.",
    hasPair(min(cyclicJumps)),
  ),
  stat(
    "DistinctDiagonalSums",
    "The number of distinct sums along the diagonals of the permutation matrix.",
    nonEmpty(
      count(
        span(0, length()),
        greater(count(span(subtract(1, length()), subtract(length(), 1)), equals(diagonalCount("k"), "v"), "k"), 0),
        "v",
      ),
    ),
    "The sum along the diagonal k counts the i with p(i) - i = k, empty diagonals included.",
  ),
  stat(
    "MaximalDiagonalOccupancy",
    "The most entries on one diagonal of the permutation matrix: the largest number of i sharing a p(i) - i.",
    nonEmpty(max(forEach(positions, count(positions, equals(subtract(wordAtJ, "j"), subtract(here, "i")), "j")))),
  ),
  word("DescentsOfDistanceThree", "Positions i with p(i) > p(i+3).", pairsAtDistance(3, greater)),
  word(
    "RepeatedLehmerCodeEntries",
    "The Lehmer code's length less its number of distinct entries.",
    nonEmpty(
      subtract(
        length(),
        count(span(0, subtract(length(), 1)), greater(count(positions, equals(lehmerCodeAt, "v")), 0), "v"),
      ),
    ),
  ),
  word(
    "AdjacenciesWithZeroAppended",
    "Positions i with p(i) = p(i+1) + 1, reading p(n+1) = 0.",
    nonEmpty(count(positions, ["If", equals("i", length()), equals(here, 1), equals(here, add(next, 1))])),
    "Adjacencies counts the same without the appended zero.",
  ),
  stat(
    "SmallestFixedPoint",
    "The smallest i with p(i) = i, or n + 1 when there is none.",
    min(["Join", where(span(1, length()), equals(here, "i")), ["List", add(length(), 1)]]),
  ),
  stat(
    "LargestWeakExcedancePosition",
    "The largest i with p(i) >= i.",
    nonEmpty(max(where(positions, atLeastValue(here, "i")))),
  ),
  stat(
    "FixedPointsBeforeLargestMovedPoint",
    "Fixed points smaller than the largest i with p(i) != i.",
    nonEmpty(
      bind(
        "m",
        max(["Join", ["List", 0], where(positions, or(less(here, "i"), greater(here, "i")))]),
        count(span(1, "m"), equals(here, "i")),
        "number",
      ),
    ),
  ),
  stat(
    "AscentTopsWithSmallerValuesBefore",
    "Ascents i whose top p(i+1) has every smaller value among p(1), ..., p(i).",
    hasPair(count(steps1, and(risesAfter, equals(count(upToHere, less("t", next), "t"), subtract(next, 1))))),
  ),
  word(
    "DescentsOfTypeTwo",
    "Descents i with p(i) larger than everything before it.",
    hasPair(count(steps1, and(fallsAfter, equals(here, max(upToHere))))),
  ),
  word(
    "LongestSuccessionRun",
    "The length of the longest factor p(k), ..., p(l) with p(i+1) = p(i) + 1.",
    nonEmpty([
      "At",
      fold(
        x,
        ["List", 0, 0, 0],
        [
          "If",
          equals(visiting, add(carried(3), 1)),
          ["List", ["Max", ["List", carried(1), add(carried(2), 1)]], add(carried(2), 1), visiting],
          ["List", ["Max", ["List", carried(1), 1]], 1, visiting],
        ],
      ),
      1,
    ]),
    "FindStat's St001662 reads the same, but its code miscounts runs that restart after a gap, so only St001652 is matched.",
  ),
  stat(
    "MaximalModularDisplacement",
    "The largest cyclic distance between p(i) and i, taken mod n.",
    nonEmpty(
      max(
        forEach(positions, [
          "Min",
          [
            "List",
            ["Mod", add(subtract(here, "i"), length()), length()],
            ["Mod", add(subtract("i", here), length()), length()],
          ],
        ]),
      ),
    ),
  ),
  stat(
    "AdjacentTranspositions",
    "Two-cycles (i, i+1).",
    hasPair(count(steps1, and(equals(here, add("i", 1)), equals(next, "i")))),
  ),
  stat(
    "CyclicallyAdjacentTranspositions",
    "Two-cycles (i, i+1), and the two-cycle (1, n).",
    hasPair(
      add(count(steps1, and(equals(here, add("i", 1)), equals(next, "i"))), [
        "If",
        and(greater(length(), 2), and(equals(at(1), length()), equals(at(length()), 1))),
        1,
        0,
      ]),
    ),
    "For n = 2 the one two-cycle is counted once.",
  ),
  word("Bonds", "Positions i with |p(i) - p(i+1)| = 1.", hasPair(count(steps1, equals(distance(here, next), 1)))),
  word(
    "CyclicBonds",
    "Positions i with |p(i) - p(i+1)| = 1, with p(n+1) = p(1).",
    nonEmpty(count(positions, equals(distance(here, ["If", equals("i", length()), at(1), next]), 1))),
  ),
  stat(
    "Crossings",
    "Pairs i, j with i < j <= p(i) < p(j) or p(i) < p(j) < i < j.",
    arcPairs(or(and(less("i", "j"), chain(["j", here, wordAtJ], [0])), chain([here, wordAtJ, "i", "j"]))),
    "Crossings of the arcs of the permutation diagram (Corteel).",
  ),
  stat(
    "Nestings",
    "Pairs i, j with j < i < p(i) < p(j) or p(j) < p(i) <= i < j.",
    arcPairs(or(chain(["j", "i", here, wordAtJ]), chain([wordAtJ, here, "i", "j"], [1]))),
    "Nestings of the arcs of the permutation diagram.",
  ),
  stat(
    "Alignments",
    "Pairs i, j of arcs of the permutation diagram that align.",
    arcPairs(
      or(
        or(chain(["j", "i", here, wordAtJ]), chain([wordAtJ, here, "i", "j"], [1])),
        or(chain(["j", wordAtJ, here, "i"], [0]), chain([here, "i", "j", wordAtJ], [2])),
      ),
    ),
  ),
  word(
    "CyclicValleys",
    "Positions lower than both neighbours, reading the word cyclically.",
    nonEmpty(
      bind(
        "w",
        cyclicWord,
        count(
          span(2, subtract(length("w"), 1)),
          and(greater(at(subtract("i", 1), "w"), at("i", "w")), less(at("i", "w"), at(add("i", 1), "w"))),
        ),
      ),
    ),
    "As many cyclic peaks as cyclic valleys, so this is both.",
  ),
  stat(
    "CyclePeaks",
    "Values i with p^-1(i) < i > p(i).",
    nonEmpty(count(positions, and(less(positionOf("i"), "i"), less(here, "i")))),
    "Every cycle has as many peaks as valleys, so this is the cycle valleys too.",
  ),
  word(
    "NonOverlappingDescents",
    "Descents taken greedily left to right, none starting where the last one ended.",
    hasPair([
      "At",
      fold(
        steps1,
        ["List", 0, -1],
        [
          "If",
          and(greater(at(visiting), at(add(visiting, 1))), less(carried(2), subtract(visiting, 1))),
          ["List", add(carried(1), 1), visiting],
          "a",
        ],
      ),
      1,
    ]),
    "Each maximal descending run of length m contributes floor(m / 2).",
  ),
  stat(
    "VisibleInversions",
    "Pairs i < j with p(j) <= min(i, p(i)).",
    hasPair(sumOverPairs(and(atMostValue(wordAtJ, "i"), atMostValue(wordAtJ, here)), 1)),
  ),
  stat(
    "InvisibleInversions",
    "Pairs i < j with p(i) > p(j) > i.",
    hasPair(sumOverPairs(and(greater(here, wordAtJ), greater(wordAtJ, "i")), 1)),
  ),
  word(
    "PrefixSumProduct",
    "The product of the prefix sums p(1) + ... + p(i) for i < n.",
    hasPair(["Product", forEach(steps1, ["Sum", upToHere])], 1),
  ),
];

/** Occurrences of a vincular pattern whose last two entries are adjacent: any i, then j, j + 1. */
const occurrencesWithAdjacentEnd = (pattern: readonly number[]): MathJSON =>
  atLeast(
    3,
    sumOver(
      ["Range", 2, subtract(length(), 1)],
      count(["Range", 1, subtract("j", 1)], orderedAs(pattern, [at("i"), at("j"), at(add("j", 1))]), "i"),
      "j",
    ),
  );
/** The descents: the vincular pattern (21). */
const adjacentDescents: MathJSON = hasPair(count(adjacent, fallsAfter));

/** The 1-based position of the value `v`, summed over a variable that `v` does not mention. */
const positionOfValue = (v: MathJSON): MathJSON => sumOver(positions, ["If", equals(at("m"), v), "m", 0], "m");

/** The values at positions `from .. to`, read with a variable the caller's loops do not use. */
const between = (from: MathJSON, to: MathJSON): MathJSON => forEach(["Range", from, to], at("k"), "k");

/** a, b, c, d run once round a circle, from whichever starting point. */
const cyclicOrder = (a: MathJSON, b: MathJSON, c: MathJSON, d: MathJSON): MathJSON =>
  or(or(chain([a, b, c, d]), chain([b, c, d, a])), or(chain([c, d, a, b]), chain([d, a, b, c])));

/** The floor of m / 2 for an integer m >= 0, with no Floor. */
const halfFloor = (m: MathJSON): MathJSON => ["Divide", subtract(m, ["Mod", m, 2]), 2];

/** The gap to the nearest greater entry, the entries beyond either end counting as greater. */
const distanceToGreater: MathJSON = [
  "Min",
  [
    "Join",
    ["List", "i", subtract(add(length(), 1), "i")],
    forEach(where(positions, greater(at("j"), here), "j"), distance("j", "i"), "j"),
  ],
];

/** The positions i that start an occurrence of the pattern: i < j < k with the values ordered as it says. */
const distinctFirstPositions = (pattern: readonly number[]): MathJSON =>
  atLeast(
    3,
    count(
      ["Range", 1, subtract(length(), 2)],
      greater(
        sumOver(
          ["Range", add("i", 1), subtract(length(), 1)],
          count(["Range", add("j", 1), length()], orderedAs(pattern, [at("i"), at("j"), at("k")]), "k"),
          "j",
        ),
        0,
      ),
    ),
  );
/** The positions j in the middle of an occurrence of the pattern: i < j < k with the values ordered as it says. */
const distinctMiddlePositions = (pattern: readonly number[]): MathJSON =>
  atLeast(
    3,
    count(
      ["Range", 2, subtract(length(), 1)],
      greater(
        sumOver(
          ["Range", 1, subtract("j", 1)],
          count(["Range", add("j", 1), length()], orderedAs(pattern, [at("i"), at("j"), at("k")]), "k"),
          "i",
        ),
        0,
      ),
      "j",
    ),
  );

/** Pairs i < j with p(i) > p(j) that are admissible in Shareshian and Wachs's sense. */
const shareshianWachsAdmissible: MathJSON = sumOverPairs(
  and(
    greater(here, wordAtJ),
    or(
      ["If", less("j", length()), less(wordAtJ, at(add("j", 1))), "False"],
      ["If", less(add("i", 1), "j"), greater(wordAtJ, min(between(add("i", 1), subtract("j", 1)))), "False"],
    ),
  ),
  1,
);

/** The cycle (p(1), ..., p(n), n + 1) as a one-line permutation of n + 1: each value goes to the one after it. */
const cyclicEmbedding: MathJSON = forEach(
  ["Range", 1, add(length(), 1)],
  [
    "If",
    equals("v", add(length(), 1)),
    at(1),
    sumOver(
      positions,
      ["If", equals(at("m"), "v"), ["If", equals("m", length()), add(length(), 1), at(add("m", 1))], 0],
      "m",
    ),
  ],
  "v",
);

// The seventh batch: the vincular family mak, mad and makl, the cyclic and arc counts, and a few small leftovers.
const FINDSTAT_PERMUTATION_STATISTICS_7: readonly Definition[] = [
  stat(
    "OneBoxPatterns",
    "Positions i with a neighbouring entry, left or right, differing from p(i) by exactly 1.",
    hasPair(
      count(
        positions,
        or(
          ["If", greater("i", 1), equals(distance(here, previous), 1), "False"],
          ["If", less("i", length()), equals(distance(here, next), 1), "False"],
        ),
      ),
    ),
  ),
  stat(
    "MaximumOfDescentsAndInverseDescents",
    "The larger of the number of descents and the number of inverse descents.",
    hasPair([
      "Max",
      [
        "List",
        count(adjacent, fallsAfter),
        count(adjacent, greater(positionOfValue("i"), positionOfValue(add("i", 1)))),
      ],
    ]),
  ),
  word(
    "InvisibleDescents",
    "Positions i with p(i) > p(i+1) > i.",
    hasPair(count(adjacent, and(fallsAfter, greater(next, "i")))),
  ),
  word(
    "VisibleDescents",
    "Positions i with p(i+1) <= min(i, p(i)).",
    hasPair(count(adjacent, and(atMostValue(next, "i"), atMostValue(next, here)))),
  ),
  stat(
    "GreaterNeighborOfMaximum",
    "The larger of the two entries beside n, an end counting as 0.",
    nonEmpty(
      sumOver(positions, [
        "If",
        equals(here, length()),
        max(["List", ["If", greater("i", 1), previous, 0], ["If", less("i", length()), next, 0]]),
        0,
      ]),
    ),
  ),
  stat(
    "InversionsOfThirdEntry",
    "Positions after the third with a smaller entry than p(3).",
    atLeast(4, count(["Range", 4, length()], less(at("j"), at(3)), "j")),
  ),
  stat(
    "InversionsOfSecondEntry",
    "Positions after the second with a smaller entry than p(2).",
    atLeast(3, count(["Range", 3, length()], less(at("j"), at(2)), "j")),
  ),
  stat(
    "SumOfDistancesToGreaterElement",
    "Over each position, the gap to the nearest greater entry, the ends counting as greater.",
    nonEmpty(sumOver(positions, distanceToGreater)),
  ),
  stat(
    "NormalizedSumOfDistancesToGreaterElement",
    "The same sum, each gap one less: the entries strictly between a position and its nearest greater entry.",
    nonEmpty(sumOver(positions, subtract(distanceToGreater, 1))),
  ),
  stat(
    "HalfParityMismatches",
    "Half the positions i where i and p(i) differ in parity.",
    nonEmpty(["Divide", count(positions, equals(["Mod", add(here, "i"), 2], 1)), 2]),
  ),
  stat(
    "DescentWeightMinusInversions",
    "The sum of i(n - i) over the descents i, less the inversions.",
    hasPair(subtract(sumOver(adjacent, ["If", fallsAfter, ["Multiply", "i", subtract(length(), "i")], 0]), inversions)),
  ),
  stat(
    "ReducedWordSupport",
    "The simple reflections in a reduced word: the i < n with some entry of p(1), ..., p(i) larger than i.",
    hasPair(count(adjacent, greater(max(upToHere), "i"))),
    "The size of the support in the Coxeter sense: the i for which p does not preserve {1, ..., i}. PermutationSupport counts the moved points instead.",
  ),
  stat(
    "PermutationCosine",
    "The sum of i p(i).",
    nonEmpty(sumOver(positions, ["Multiply", here, "i"])),
    "The scalar product of p with the identity: n(n+1)(2n+1) / 6 times the cosine of the angle between them.",
  ),
  word(
    "Mak",
    "Foata and Zeilberger's mak: (2-31) + (32-1) + (1-32) + (21).",
    add(
      add(occurrencesWithAdjacentEnd([2, 3, 1]), occurrencesWithAdjacentStart([3, 2, 1])),
      add(occurrencesWithAdjacentEnd([1, 3, 2]), adjacentDescents),
    ),
  ),
  word(
    "Mad",
    "Foata and Zeilberger's mad: 2 (2-31) + (31-2) + (21).",
    add(
      add(occurrencesWithAdjacentEnd([2, 3, 1]), occurrencesWithAdjacentEnd([2, 3, 1])),
      add(occurrencesWithAdjacentStart([3, 1, 2]), adjacentDescents),
    ),
  ),
  word(
    "Makl",
    "Foata and Zeilberger's makl: (1-32) + (31-2) + (32-1) + (21).",
    add(
      add(occurrencesWithAdjacentEnd([1, 3, 2]), occurrencesWithAdjacentStart([3, 1, 2])),
      add(occurrencesWithAdjacentStart([3, 2, 1]), adjacentDescents),
    ),
  ),
  word(
    "BabsonSteingrimssonStatistic",
    "Babson and Steingrimsson's stat: (13-2) + (21-3) + (32-1) + (21).",
    add(
      add(occurrencesWithAdjacentStart([1, 3, 2]), occurrencesWithAdjacentStart([2, 1, 3])),
      add(occurrencesWithAdjacentStart([3, 2, 1]), adjacentDescents),
    ),
  ),
  word(
    "UlamDistance",
    "The entries to remove to leave an increasing sequence: n less the length of a longest increasing subsequence.",
    nonEmpty(subtract(length(), ["Count", piles(["Less", "t", visiting])])),
    "FindStat takes the longest increasing subsequence of the inverse, which has the same length.",
  ),
  stat(
    "EvenWeakDeficienciesAndOddWeakExcedances",
    "Positions i with p(i) <= i for even i, and p(i) >= i for odd i.",
    nonEmpty(count(positions, ["If", equals(["Mod", "i", 2], 0), atMostValue(here, "i"), atLeastValue(here, "i")])),
  ),
  word(
    "VerticalSeparators",
    "Interior positions i with |p(i-1) - p(i+1)| = 1.",
    hasTriple(count(interior, equals(distance(previous, next), 1))),
  ),
  stat(
    "CyclicAlignments",
    "Pairs (i, j) with i, j, p(j), p(i) in cyclic order.",
    arcPairs(cyclicOrder("i", "j", wordAtJ, here)),
  ),
  stat(
    "CyclicMisalignments",
    "Pairs (i, j) with i, p(i), j, p(j) in cyclic order.",
    arcPairs(cyclicOrder("i", here, "j", wordAtJ)),
  ),
  stat(
    "CyclicCrossings",
    "Pairs (i, j) with i, p(j), p(i), j in cyclic order.",
    arcPairs(cyclicOrder("i", wordAtJ, here, "j")),
  ),
  stat(
    "RestrictedNonInversionsBetweenExcedances",
    "Pairs i < j < p(i) < p(j).",
    arcPairs(chain(["i", "j", here, wordAtJ])),
  ),
  stat(
    "InversionsBetweenExcedancesWithLinkedGreater",
    "Pairs i < j < p(j) < p(i) with p^-1(j) < j.",
    arcPairs(and(chain(["i", "j", wordAtJ, here]), less(positionOfValue("j"), "j"))),
  ),
  stat(
    "RestrictedNonInversionsBetweenExcedancesWithLinkedRightmost",
    "Pairs i < j < p(i) < p(j) with p^-1(j) < j.",
    arcPairs(and(chain(["i", "j", here, wordAtJ]), less(positionOfValue("j"), "j"))),
  ),
  stat(
    "InversionsBetweenExcedancesAndFixedPoints",
    "Pairs i < j = p(j) < p(i).",
    arcPairs(and(equals(wordAtJ, "j"), and(less("i", "j"), less("j", here)))),
  ),
  stat("UpperMiddleEntry", "The entry p(floor(n/2) + 1).", nonEmpty(at(add(halfFloor(length()), 1)))),
  stat("LowerMiddleEntry", "The entry p(floor((n+1)/2)).", nonEmpty(at(halfFloor(add(length(), 1))))),
  word(
    "Convexity",
    "The largest 2 p(i) - p(i-1) - p(i+1) over the interior positions, or 0.",
    hasTriple(max(["Join", ["List", 0], forEach(interior, subtract(subtract(["Multiply", 2, here], previous), next))])),
  ),
  word(
    "ProperBlocks",
    "Windows p(i), ..., p(j) of two or more entries whose values are consecutive integers, the whole word excepted.",
    atLeast(
      3,
      subtract(
        sumOver(
          adjacent,
          count(
            ["Range", add("i", 1), length()],
            equals(subtract(max(between("i", "j")), min(between("i", "j"))), subtract("j", "i")),
            "j",
          ),
        ),
        1,
      ),
    ),
  ),
  word(
    "HertzsprungOccurrencesOf132",
    "Positions i with p(i+1) = p(i) + 2 and p(i+2) = p(i) + 1.",
    hasTriple(
      count(
        ["Range", 1, subtract(length(), 2)],
        and(equals(next, add(here, 2)), equals(at(add("i", 2)), add(here, 1))),
      ),
    ),
  ),
  word("PositionsOfLetterOneIn123", "Positions that start an occurrence of 123.", distinctFirstPositions([1, 2, 3])),
  word("PositionsOfLetterOneIn132", "Positions that start an occurrence of 132.", distinctFirstPositions([1, 3, 2])),
  word("PositionsOfLetterTwoIn213", "Positions that start an occurrence of 213.", distinctFirstPositions([2, 1, 3])),
  word(
    "PositionsOfLetterThreeIn132",
    "Positions that are the middle of an occurrence of 132.",
    distinctMiddlePositions([1, 3, 2]),
  ),
  word(
    "OccurrencesOf14Dash2Dash3Or14Dash3Dash2",
    "Adjacent ascents p(i) < p(i+1) with two later entries between them, in either order, counted in pairs.",
    hasTriple(
      sumOver(
        ["Range", 1, subtract(length(), 2)],
        [
          "If",
          risesAfter,
          bind(
            "c",
            count(["Range", add("i", 2), length()], and(less(here, at("j")), less(at("j"), next)), "j"),
            ["Divide", ["Multiply", "c", subtract("c", 1)], 2],
            "number",
          ),
          0,
        ],
      ),
    ),
  ),
  stat(
    "InversionsOfCyclicEmbedding",
    "The inversions of the cycle (p(1), ..., p(n), n + 1), as a permutation of n + 1.",
    nonEmpty(
      bind(
        "q",
        cyclicEmbedding,
        sumOver(
          ["Range", 1, length()],
          count(["Range", add("i", 1), add(length(), 1)], greater(at("i", "q"), at("j", "q")), "j"),
        ),
        "list<integer>",
      ),
    ),
  ),
  word(
    "ShareshianWachsAdmissibleInversions",
    "Pairs i < j with p(i) > p(j) and either p(j) < p(j+1) or some entry between them smaller than p(j).",
    hasPair(shareshianWachsAdmissible),
  ),
  word(
    "AdmissibleInversionsPlusDescents",
    "ShareshianWachsAdmissibleInversions plus the descents.",
    hasPair(add(shareshianWachsAdmissible, count(adjacent, fallsAfter))),
    "Shareshian and Wachs's aid.",
  ),
  word(
    "AdmissibleInversions",
    "Pairs i < j with p(i) > p(j) and either p(i-1) < p(i) or some entry between them larger than p(i).",
    hasPair(
      sumOverPairs(
        and(
          greater(here, wordAtJ),
          or(
            ["If", greater("i", 1), less(previous, here), "False"],
            ["If", less(add("i", 1), "j"), greater(max(between(add("i", 1), subtract("j", 1))), here), "False"],
          ),
        ),
        1,
      ),
    ),
    "FindStat's St000866 is the Shareshian-Wachs version, which differs.",
  ),
  stat(
    "LargestGreatestCommonDivisorOfPositionAndValue",
    "The largest gcd(i, p(i)).",
    nonEmpty(max(forEach(positions, ["Divide", ["Multiply", "i", here], ["LCM", "i", here]]))),
  ),
];

export const PERMUTATION_STATISTICS: readonly Definition[] = [
  word("Descents", "Positions i with p(i) > p(i+1).", hasPair(count(adjacent, fallsAfter))),
  word("Ascents", "Positions i with p(i) < p(i+1).", hasPair(count(adjacent, risesAfter))),

  word(
    "MajorIndex",
    "The SUM of the descent positions — not their count.",
    hasPair(["Sum", where(adjacent, fallsAfter)]),
    "The distinction from Descents is the entire content of the statistic.",
  ),
  word("MinorIndex", "The sum of the ascent positions.", hasPair(["Sum", where(adjacent, risesAfter)])),

  word("Inversions", "Pairs i < j with p(i) > p(j).", hasPair(inversions)),
  stat(
    "Sign",
    "The sign of p: +1 when the inversion count is even, -1 when odd.",
    hasPair(["Power", -1, inversions], 1),
  ),

  stat("FixedPoints", "Positions with p(i) = i.", nonEmpty(count(positions, equals(here, "i")))),
  stat("Excedances", "Positions with p(i) > i.", nonEmpty(count(positions, greater(here, "i")))),
  stat("WeakExcedances", "Positions with p(i) >= i.", nonEmpty(count(positions, atLeastValue(here, "i")))),
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
    "The smallest descent position, or n when p is increasing.",
    hasPair(["If", equals(count(adjacent, fallsAfter), 0), length(), ["Min", where(adjacent, fallsAfter)]], length()),
    "FindStat St000654: p(n+1) = 0, so position n always descends.",
  ),
  word(
    "FirstAscent",
    "The smallest ascent position, or n when p is decreasing.",
    hasPair(["If", equals(count(adjacent, risesAfter), 0), length(), ["Min", where(adjacent, risesAfter)]], length()),
    "FindStat St000990.",
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

  // The moved points, as Wolfram reads them: positions where p(i) differs from i. Their number,
  // largest and smallest are Length, Max and Min of this, not heads of their own.
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
  ...FINDSTAT_PERMUTATION_STATISTICS,
  ...FINDSTAT_PERMUTATION_STATISTICS_2,
  ...FINDSTAT_PERMUTATION_STATISTICS_3,
  ...FINDSTAT_PERMUTATION_STATISTICS_4,
  ...FINDSTAT_PERMUTATION_STATISTICS_5,
  ...FINDSTAT_PERMUTATION_STATISTICS_6,
  ...FINDSTAT_PERMUTATION_STATISTICS_7,
];
