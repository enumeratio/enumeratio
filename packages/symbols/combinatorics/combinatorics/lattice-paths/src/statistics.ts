// Dyck-path statistics, over `_x` = the step word: 1 for an up step, 0 for a down step.
//
// Everything here is a statement about the HEIGHT PROFILE, so that is defined once and the
// statistics read it. `heightAfter(i)` is (ups - downs) over the first i steps, which for a
// 0/1 word is the sum of (2*step - 1).

import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import {
  add,
  and,
  atLeast,
  bind,
  carried,
  fold,
  visiting,
  x,
  at,
  count,
  equals,
  forEach,
  greater,
  hasPair,
  length,
  less,
  nonEmpty,
  or,
  positions,
  subtract,
  sumOver,
  upTo,
  where,
} from "../../src/statistics/vocabulary.ts";

const on = "DyckPath";
const stat = (head: string, summary: string, expr: Definition["expr"], note?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
});

const step = (i: MathJSON): MathJSON => at(i);
/** Height after the first `i` steps: each up step is +1, each down step is -1. */
const heightAfter = (i: MathJSON): MathJSON => sumOver(upTo(i), subtract(["Multiply", 2, at("k")], 1), "k");
/** The height profile, one entry per prefix. */
const profile: MathJSON = forEach(positions, heightAfter("i"));

const isUp = (i: MathJSON): MathJSON => equals(step(i), 1);
const isDown = (i: MathJSON): MathJSON => equals(step(i), 0);
const nextIndex: MathJSON = add("i", 1);

/** The longest run of a given step value, carried as (best, current). */
const longestRunOf = (value: number): MathJSON => [
  "At",
  fold(
    x,
    ["List", 0, 0],
    [
      "If",
      ["Equal", visiting, value],
      ["List", ["Max", ["List", carried(1), ["Add", carried(2), 1]]], ["Add", carried(2), 1]],
      ["List", carried(1), 0],
    ],
  ),
  1,
];

// Bounce and dinv both read the AREA SEQUENCE — a value per up-step, against the diagonal,
// not the axis (a different reading from `Area` above, which sums the height profile). a_i
// is the height right before the i-th up step — read straight off `heightAfter`, at the
// position just before that step, rather than folded up while walking the word: a fold's
// accumulator has to stay one uniform element type across every index compute-engine looks
// at, and (height, growing list) mixes a number with a list in the same slot, which is
// exactly the shape compute-engine 0.128 mis-infers (Join silently degrades to a 2-element
// List once any index of the accumulator is used arithmetically elsewhere in the same
// Function). Reading positions filtered by step type sidesteps the whole accumulator.
const heightBefore = (i: MathJSON): MathJSON => ["If", less(i, 2), 0, heightAfter(subtract(i, 1))];

/** a_1 .. a_n, one entry per up step: the height right before taking it. */
const areaSequence: MathJSON = forEach(where(positions, isUp("i")), heightBefore("i"));
/**
 * H(0) .. H(n-1): the height directly above column x, one entry per down step. The NE
 * y-coordinate right before the down step is the mountain height there plus how many down
 * steps already happened — the count is `x` itself, 0 for the first down step.
 */
const columnCeilings: MathJSON = forEach(
  where(positions, isDown("i")),
  add(heightBefore("i"), count(upTo(subtract("i", 1)), isDown("k"), "k")),
);
const areaAt = (i: MathJSON): MathJSON => at(i, areaSequence);
const semilength: MathJSON = ["Divide", length(), 2];

// One tick of the bounce walk. Accumulator is (k, blockIndex, total): k is the current
// diagonal touch point, blockIndex counts how many climbs have happened so far, total is the
// running bounce weight. Once k reaches n the walk is done and the tick is a no-op, which is
// what lets a fixed n-tick fold stand in for "until k reaches n".
const bounceStep: MathJSON = [
  "If",
  equals(carried(1), semilength),
  ["List", carried(1), carried(2), carried(3)],
  [
    "List",
    at(add(carried(1), 1), columnCeilings),
    add(carried(2), 1),
    add(carried(3), ["Multiply", carried(2), subtract(at(add(carried(1), 1), columnCeilings), carried(1))]),
  ],
];

// ── peaks and rises, for the FindStat statistics that read them ────────────────────────────

const isPeak: MathJSON = and(isUp("i"), isDown(nextIndex));
/** Positions of the up steps that end a rise (a peak's up step), in order. */
const peakPositions: MathJSON = where(upTo(subtract(length(), 1)), isPeak);
/** The height of each peak, left to right. */
const peakHeights: MathJSON = forEach(peakPositions, heightAfter("i"));
/** Up steps among the first `i` steps. */
const upsUpTo = (i: MathJSON): MathJSON => count(upTo(i), isUp("k"), "k");
/** The length of each rise (maximal run of up steps), left to right. Up steps are counted at
 *  each peak, and a rise is what accrues since the previous peak. */
const riseLengths: MathJSON = bind(
  "u",
  forEach(peakPositions, upsUpTo("i")),
  forEach(
    ["Range", 1, ["Length", "u"]],
    ["If", equals("k", 1), ["At", "u", 1], subtract(["At", "u", "k"], ["At", "u", subtract("k", 1)])],
    "k",
  ),
);
/** First position of the double rises' pairs (an up step followed by an up step); 0 if none. */
const lastDoubleRise: MathJSON = bind("doubles", where(upTo(subtract(length(), 1)), and(isUp("i"), isUp(nextIndex))), [
  "If",
  equals(["Length", "doubles"], 0),
  0,
  ["Max", "doubles"],
]);
/** A step `i` that equals its successor, at positions where one exists. */
const repeatsAt = (value: number): MathJSON =>
  where(upTo(subtract(length(), 1)), and(equals(step("i"), value), equals(step(nextIndex), value)));
/** Occurrences of a three-step pattern, 1 for an up step and 0 for a down step. */
const occurrencesOf = (a: number, b: number, c: number): MathJSON =>
  atLeast(
    3,
    count(
      upTo(subtract(length(), 2)),
      and(and(equals(step("i"), a), equals(step(add("i", 1)), b)), equals(step(add("i", 2)), c)),
    ),
  );
const height: MathJSON = ["Max", profile];

export const DYCK_STATISTICS: readonly Definition[] = [
  stat("Height", "The greatest height the path reaches.", nonEmpty(["Max", profile])),

  stat(
    "Peaks",
    "Occurrences of an up step immediately followed by a down step.",
    hasPair(count(upTo(subtract(length(), 1)), and(isUp("i"), isDown(nextIndex)))),
  ),
  stat(
    "Valleys",
    "Occurrences of a down step immediately followed by an up step.",
    hasPair(count(upTo(subtract(length(), 1)), and(isDown("i"), isUp(nextIndex)))),
  ),
  stat(
    "DoubleRises",
    "Occurrences of two consecutive up steps.",
    hasPair(count(upTo(subtract(length(), 1)), and(isUp("i"), isUp(nextIndex)))),
  ),

  stat(
    "Returns",
    "Points where the path comes back to height 0.",
    nonEmpty(count(positions, equals(heightAfter("i"), 0))),
  ),
  stat(
    "TouchPointCount",
    "Points where the path touches the axis — the returns.",
    nonEmpty(count(positions, equals(heightAfter("i"), 0))),
    "The catalog carries both spellings; they are the same statistic, which is why both are defined rather than one aliased to the other.",
  ),
  stat(
    "InteriorReturns",
    "Returns to height 0 strictly before the end.",
    nonEmpty(count(positions, and(equals(heightAfter("i"), 0), less("i", length())))),
  ),
  stat(
    "Hills",
    "Peaks at height 1 — an up step from the axis immediately followed by a down step.",
    hasPair(count(upTo(subtract(length(), 1)), and(and(isUp("i"), isDown(nextIndex)), equals(heightAfter("i"), 1)))),
  ),

  stat(
    "InitialRise",
    "The length of the opening run of up steps.",
    nonEmpty(count(positions, equals(heightAfter("i"), "i"))),
    "Height equals the index exactly while every step so far has been an up step.",
  ),

  stat(
    "MajorIndex",
    "The sum of the descent positions of the step word — where an up step is followed by a down step.",
    hasPair(["Sum", where(upTo(subtract(length(), 1)), and(isUp("i"), isDown(nextIndex)))]),
    "Same name as the permutation statistic, genuinely a different function — which is why definitions are keyed by signature.",
  ),

  stat(
    "Area",
    "The area between the path and the axis: the total of the heights after each step.",
    nonEmpty(["Sum", profile]),
  ),
  stat(
    "Coarea",
    "The complement of the area within the enclosing triangle.",
    nonEmpty(
      subtract(
        ["Divide", ["Multiply", ["Divide", length(), 2], add(["Divide", length(), 2], 1)], 2],
        ["Divide", ["Sum", profile], 1],
      ),
    ),
    "Defined against the n(n+1)/2 triangle for a path of 2n steps.",
  ),
  stat("LongestAscent", "The longest run of consecutive up steps.", nonEmpty(longestRunOf(1))),
  stat("LongestDescent", "The longest run of consecutive down steps.", nonEmpty(longestRunOf(0))),

  stat(
    "Dinv",
    "The dinv statistic, read from the area sequence.",
    atLeast(
      4,
      sumOver(
        upTo(semilength),
        // Guarded rather than left to `Range(i+1, n)`: compute-engine's `Range` does not
        // collapse to empty when its start exceeds its end (it returns the two endpoints
        // instead — the same gotcha `atLeast`/`hasPair` exist to dodge, just at the OTHER
        // end of the range), so the last position's empty tail needs an explicit floor.
        [
          "If",
          less("i", semilength),
          count(
            ["Range", add("i", 1), semilength],
            or(equals(areaAt("i"), areaAt("j")), equals(areaAt("i"), add(areaAt("j"), 1))),
            "j",
          ),
          0,
        ],
      ),
    ),
    "dinv = #{i<j : a_i=a_j} + #{i<j : a_i=a_j+1}; the two counts never overlap (a_i=a_j and a_i=a_j+1 can't both hold), so this is one pass over the pairs.",
  ),

  // The bounce path reads the same column ceilings H(x) that dinv reads a different way:
  // start at (0,0), climb to H(0), cross to the diagonal at k_1 = H(0), climb to H(k_1), cross
  // to k_2 = H(k_1), and so on until reaching n. bounce(D) weights each climb's length by how
  // many crossings came before it — the first climb contributes nothing, the next is weighted
  // by 1, and so on. Written as a fold over n ticks rather than the unbounded "until reaching
  // n" loop: once k reaches n the step is a no-op, so a fixed n-tick fold always finishes the
  // walk (it has at most n climbs) and idles for the rest.
  stat(
    "Bounce",
    "The bounce statistic, which walks the path bouncing off its own peaks.",
    atLeast(2, ["At", fold(upTo(semilength), ["List", 0, 0, 0], bounceStep), 3]),
    "Equidistributed with Area: (Bounce, Area) and (Area, Dinv) share the same bivariate distribution (see dyck.test.ts).",
  ),

  // ── FindStat's Dyck-path statistics, named after their descriptions ──────────────────────

  stat(
    "FirstComponentSemilength",
    "The position of the first return to height 0, counted in up steps: half the steps of the first primitive component.",
    nonEmpty(["Divide", ["Min", where(positions, equals(heightAfter("i"), 0))], 2]),
    'FindStat\'s "position of the first return" counts up steps, not steps: UD is 1.',
  ),
  stat(
    "DownStepHeightProduct",
    "The product, over the down steps, of the height each starts from.",
    nonEmpty(["Product", forEach(where(positions, isDown("i")), add(heightAfter("i"), 1))], 1),
  ),
  stat(
    "ValleysAboveAxis",
    "Valleys not on the axis: a down step followed by an up step, at height above 0.",
    hasPair(count(upTo(subtract(length(), 1)), and(and(isDown("i"), isUp(nextIndex)), greater(heightAfter("i"), 0)))),
  ),
  stat("OccurrencesOfDDU", "Occurrences of two down steps followed by an up step.", occurrencesOf(0, 0, 1)),
  stat("OccurrencesOfUUU", "Occurrences of three consecutive up steps.", occurrencesOf(1, 1, 1)),
  stat("OccurrencesOfUDU", "Occurrences of an up, a down and an up step.", occurrencesOf(1, 0, 1)),

  stat("PeakHeightSum", "The sum of the heights of the peaks.", hasPair(["Sum", peakHeights])),
  stat(
    "PeakHeightExcess",
    "The sum of the heights of the peaks, less the number of peaks.",
    hasPair(["Sum", forEach(peakHeights, subtract("h", 1), "h")]),
  ),
  stat(
    "PeakHeightSquareSum",
    "The sum of the squares of the heights of the peaks.",
    hasPair(["Sum", forEach(peakPositions, ["Multiply", heightAfter("i"), heightAfter("i")])]),
  ),
  stat("PeakHeightProduct", "The product of the heights of the peaks.", hasPair(["Product", peakHeights], 1)),

  stat("LastUpStepPosition", "The position of the last up step.", nonEmpty(["Max", where(positions, isUp("i"))])),
  stat(
    "FirstDownStepPosition",
    "The position of the first down step.",
    nonEmpty(["Min", where(positions, isDown("i"))]),
  ),
  stat("LastDoubleRisePosition", "The position of the last double rise; 0 if there is none.", hasPair(lastDoubleRise)),

  stat(
    "RisesOfLengthOne",
    "Rises (maximal runs of up steps) of length 1.",
    hasPair(bind("lengths", riseLengths, count("lengths", equals("r", 1), "r"))),
  ),
  stat("MinimalRise", "The length of the shortest rise.", hasPair(["Min", riseLengths])),
  stat(
    "RisesOfLengthAtLeastTwo",
    "Rises (maximal runs of up steps) of length at least 2.",
    hasPair(bind("lengths", riseLengths, count("lengths", ["GreaterEqual", "r", 2], "r"))),
  ),

  stat(
    "UpStepsAtOddPositions",
    "Up steps at an odd position, counting from 1.",
    nonEmpty(count(positions, and(isUp("i"), equals(["Mod", "i", 2], 1)))),
  ),
  stat(
    "UpStepsAfterLastDoubleRise",
    "Up steps after the first step of the last double rise; all of them if there is none.",
    hasPair(bind("m", lastDoubleRise, count(positions, and(isUp("i"), greater("i", "m"))), "number")),
  ),

  stat(
    "DoubleRisePositionSum",
    "The sum of the positions where an up step is followed by an up step.",
    hasPair(["Sum", repeatsAt(1)]),
  ),
  stat(
    "DoubleFallPositionSum",
    "The sum of the positions where a down step is followed by a down step.",
    hasPair(["Sum", repeatsAt(0)]),
  ),
  stat(
    "MacMahonEqualIndex",
    "The sum of the positions of double rises and double falls: MacMahon's equal index of the step word.",
    hasPair(["Add", ["Sum", repeatsAt(1)], ["Sum", repeatsAt(0)]]),
  ),

  stat(
    "LogarithmicHeight",
    "The floor of the binary logarithm of the height plus one.",
    nonEmpty(
      bind("h", height, count(["Range", 1, add("h", 1)], ["LessEqual", ["Power", 2, "k"], add("h", 1)], "k"), "number"),
    ),
  ),
  stat(
    "FirstMaximalPeakPosition",
    "The position of the up step into the first peak of maximal height.",
    nonEmpty(bind("h", height, ["Min", where(positions, equals(heightAfter("i"), "h"))], "number")),
  ),
  stat(
    "GlobalMaxima",
    "The number of points of the path at the greatest height it reaches.",
    ["If", equals(length(), 0), 1, bind("h", height, count(positions, equals(heightAfter("i"), "h")), "number")],
    "The origin counts as a point, so the empty path has one; otherwise these are its highest peaks.",
  ),
  stat(
    "LargestAreaSequenceEntry",
    "The largest entry of the area sequence: the greatest area to the right of an up step.",
    nonEmpty(["Max", areaSequence]),
  ),
];
