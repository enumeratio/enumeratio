// Dyck-path statistics, over `_x` = the step word: 1 for an up step, 0 for a down step.
//
// Everything here is a statement about the HEIGHT PROFILE, so that is defined once and the
// statistics read it. `heightAfter(i)` is (ups - downs) over the first i steps, which for a
// 0/1 word is the sum of (2*step - 1).

import type { Definition, MathJSON } from "./types.ts";
import {
  add,
  and,
  atLeast,
  carried,
  fold,
  visiting,
  x,
  at,
  count,
  equals,
  forEach,
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
} from "./vocabulary.ts";

const on = "DyckPath";
const stat = (
  head: string,
  summary: string,
  expr: Definition["expr"],
  note?: string,
): Definition => ({ head, on, summary, expr, ...(note ? { note } : {}) });

const step = (i: MathJSON): MathJSON => at(i);
/** Height after the first `i` steps: each up step is +1, each down step is -1. */
const heightAfter = (i: MathJSON): MathJSON =>
  sumOver(upTo(i), subtract(["Multiply", 2, at("k")], 1), "k");
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
    add(carried(3), [
      "Multiply",
      carried(2),
      subtract(at(add(carried(1), 1), columnCeilings), carried(1)),
    ]),
  ],
];

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
    hasPair(
      count(
        upTo(subtract(length(), 1)),
        and(and(isUp("i"), isDown(nextIndex)), equals(heightAfter("i"), 1)),
      ),
    ),
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
];
