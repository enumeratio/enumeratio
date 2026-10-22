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

/**
 * Occurrences of a classical pattern of length 4: quadruples i < j < k < l whose values stand in
 * the order `pattern` gives. The pattern's positions, sorted by value, become a chain of `<`.
 */
const occurrencesOfLength4Pattern = (pattern: readonly number[]): MathJSON => {
  const names = ["i", "j", "k", "l"];
  const byValue = [0, 1, 2, 3].toSorted((a, b) => pattern[a]! - pattern[b]!);
  const chain = byValue
    .slice(1)
    .map((position, rank) => less(at(names[byValue[rank]!]!), at(names[position]!)))
    .reduce((all, step) => and(all, step));
  const n = length();
  return atLeast(
    4,
    sumOver(
      ["Range", 1, subtract(n, 3)],
      sumOver(
        ["Range", add("i", 1), subtract(n, 2)],
        sumOver(["Range", add("j", 1), subtract(n, 1)], count(["Range", add("k", 1), n], chain, "l"), "k"),
        "j",
      ),
    ),
  );
};

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
  word("OccurrencesOf1324", "Quadruples i < j < k < l ordered as 1324.", occurrencesOfLength4Pattern([1, 3, 2, 4])),
  word("OccurrencesOf2143", "Quadruples i < j < k < l ordered as 2143.", occurrencesOfLength4Pattern([2, 1, 4, 3])),
  word("OccurrencesOf4231", "Quadruples i < j < k < l ordered as 4231.", occurrencesOfLength4Pattern([4, 2, 3, 1])),
  word("OccurrencesOf2413", "Quadruples i < j < k < l ordered as 2413.", occurrencesOfLength4Pattern([2, 4, 1, 3])),
  word("OccurrencesOf1432", "Quadruples i < j < k < l ordered as 1432.", occurrencesOfLength4Pattern([1, 4, 3, 2])),
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
];
