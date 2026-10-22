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
  atLeastValue,
  atMostValue,
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

// Area, dinv and bounce all read the AREA SEQUENCE — a value per up-step, against the diagonal,
// not the axis (the height profile sums to twice the area plus n). a_i
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
 * The bounce path starts at the end of the path and travels toward the origin, so it reads the
 * path from the right: H(x) for x = 0 .. n-1 is the height after the (n-x)-th up step, plus x
 * (the up steps still to come). `ups` holds the positions of the up steps.
 */
const bounceCeilings: MathJSON = bind(
  "ups",
  where(positions, isUp("i")),
  forEach(
    upTo(["Divide", length(), 2]),
    add(heightAfter(at(subtract(add(["Divide", length(), 2], 1), "j"), "ups")), subtract("j", 1)),
    "j",
  ),
);
const areaAt = (i: MathJSON): MathJSON => at(i, areaSequence);
const semilength: MathJSON = ["Divide", length(), 2];

// One tick of the bounce walk, over the ceilings read from the end. Accumulator is (k, blockIndex, total): k is the current
// diagonal touch point, blockIndex counts how many climbs have happened so far, total is the
// running bounce weight. Once k reaches n the walk is done and the tick is a no-op, which is
// what lets a fixed n-tick fold stand in for "until k reaches n".
const bounceStep: MathJSON = [
  "If",
  equals(carried(1), semilength),
  ["List", carried(1), carried(2), carried(3)],
  [
    "List",
    at(add(carried(1), 1), "ceilings"),
    add(carried(2), 1),
    add(carried(3), ["Multiply", carried(2), subtract(at(add(carried(1), 1), "ceilings"), carried(1))]),
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

// ── FindStat's tunnels, runs, interactions and the rest ───────────────────────────────────

/** Down steps among the first `i` steps. */
const downsUpTo = (i: MathJSON): MathJSON => count(upTo(i), isDown("d"), "d");
/** Heights at every vertex, the origin included: vertex `v` is entry `v + 1`. */
const vertexProfile: MathJSON = ["Join", ["List", 0], profile];
/** Positions of the down steps that are followed by an up step. */
const valleyPositions: MathJSON = where(upTo(subtract(length(), 1)), and(isDown("i"), isUp(nextIndex)));
/** 1 if two adjacent steps differ (one up and one down), else 0. */
const differ = (a: MathJSON, b: MathJSON): MathJSON => ["If", equals(add(a, b), 1), 1, 0];

/**
 * For each position, the position of the up step matching it if it is a down step, else 0: the
 * last up step before it that ends at the height the down step starts from (the path between
 * stays at or above that height, or a later such up step would exist).
 */
const matchingUps: MathJSON = bind(
  "h",
  profile,
  forEach(
    positions,
    [
      "If",
      isDown("p"),
      [
        "Max",
        where(upTo(subtract("p", 1)), and(isUp("q"), equals(["At", "h", "q"], ["At", "h", subtract("p", 1)])), "q"),
      ],
      0,
    ],
    "p",
  ),
);
/** Tunnels (an up step with its matching down step) accepted by `member`, given the matching positions as `m`. */
const tunnelsWhere = (member: (p: MathJSON) => MathJSON): MathJSON =>
  where(positions, and(isDown("p"), member("p")), "p");
const centered = (p: MathJSON): MathJSON => equals(add(p, ["At", "m", p]), add(length(), 1));
const leftOf = (p: MathJSON): MathJSON => less(add(p, ["At", "m", p]), add(length(), 1));
/** Pairs of tunnels in the set, one strictly inside the other. */
const nestedTunnelPairs = (member: (p: MathJSON) => MathJSON): MathJSON =>
  bind(
    "m",
    matchingUps,
    sumOver(
      tunnelsWhere(member),
      count(
        upTo(subtract("p", 1)),
        and(and(isDown("r"), member("r")), greater(["At", "m", "r"], ["At", "m", "p"])),
        "r",
      ),
      "p",
    ),
  );
const tunnelCount = (member: (p: MathJSON) => MathJSON): MathJSON =>
  bind("m", matchingUps, ["Length", tunnelsWhere(member)]);

/**
 * The interactions of a path: runs of one step type build a count, and the next run of the other
 * type uses it up one step at a time. Accumulator: (interactions, count, previous step).
 */
const interactions = (builder: number): MathJSON => [
  "At",
  fold(
    x,
    ["List", 0, 0, 0],
    [
      "If",
      equals(visiting, builder),
      ["List", carried(1), ["If", equals(carried(3), 1 - builder), 1, add(carried(2), 1)], builder],
      [
        "If",
        greater(carried(2), 0),
        ["List", add(carried(1), 1), subtract(carried(2), 1), 1 - builder],
        ["List", carried(1), carried(2), 1 - builder],
      ],
    ],
  ),
  1,
];

/** Rises of a given length, counted by `test` on each length. */
const risesWhere = (test: (r: MathJSON) => MathJSON): MathJSON =>
  bind("lengths", riseLengths, count("lengths", test("r"), "r"));
/** Whether step `i` differs from the step before it, or is the first. */
const startsRun = (i: MathJSON): MathJSON => ["If", equals(i, 1), 1, differ(at(subtract(i, 1)), at(i))];
/** Whether step `i` differs from the step after it, or is the last. */
const endsRun = (i: MathJSON): MathJSON => ["If", equals(i, length()), 1, differ(at(i), at(add(i, 1)))];
/** A hill of size `k` starting at step `i`: k up steps then k down steps, beginning on the axis. */
const hillAt = (k: number): MathJSON => {
  const steps = Array.from({ length: 2 * k }, (_, t) => equals(step(add("i", t)), t < k ? 1 : 0));
  const shape = steps.reduce((all, one) => and(all, one));
  return and(shape, equals(["If", equals("i", 1), 0, heightAfter(subtract("i", 1))], 0));
};
/** Peaks that are (weak or strict) left-to-right maxima among the peak heights. */
const peakMaxima = (beats: "Greater" | "GreaterEqual"): MathJSON => [
  "At",
  fold(
    peakHeights,
    ["List", 0, 0],
    ["If", [beats, visiting, carried(1)], ["List", visiting, add(carried(2), 1)], ["List", carried(1), carried(2)]],
  ),
  2,
];

/** Haglund's area: the whole squares between the path and the zigzag, the sum of the area sequence. */
const areaValue: MathJSON = nonEmpty(["Divide", subtract(["Sum", profile], semilength), 2]);
const dinvValue: MathJSON = atLeast(
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
);
/** The bounce statistic, from the bounce path that starts at the end of the path. */
const bounceWalk = (field: number): MathJSON =>
  bind("ceilings", bounceCeilings, ["At", fold(upTo(semilength), ["List", 0, 0, 0], bounceStep), field]);
const bounceValue: MathJSON = atLeast(2, bounceWalk(3));
/** The number of cells of the staircase below the diagonal, binomial(n, 2). */
const triangle: MathJSON = ["Divide", ["Multiply", semilength, subtract(semilength, 1)], 2];

// ── helpers for FindStat's second Dyck-path batch ─────────────────────────────────────────

/** m!, with 0! = 1, from the core's `Product` and `Range`. */
const factorialOf = (m: MathJSON): MathJSON => ["If", equals(m, 0), 1, ["Product", ["Range", 1, m]]];
/** Ups through each peak, left to right: how high the peak's shadow reaches. */
const peakUps: MathJSON = forEach(peakPositions, upsUpTo("i"));
/** Downs before each peak, left to right: where the peak's shadow starts. */
const peakDowns: MathJSON = forEach(peakPositions, subtract("i", upsUpTo("i")));
/**
 * Boxes between the path and the diagonal (squares wholly above it), counted when `test` accepts
 * the number of peaks whose shadow covers the box. A peak's shadow is the boxes right of it and
 * below it. Column k (the k-th down step) rises to `ups before it`, so its boxes are rows k up to
 * that height less one.
 */
const boxesBelowPeaks = (test: (coveringPeaks: MathJSON) => MathJSON): MathJSON =>
  hasPair(
    bind(
      "pu",
      peakUps,
      bind(
        "pd",
        peakDowns,
        bind(
          "downs",
          where(positions, isDown("i")),
          sumOver(
            upTo(semilength),
            [
              "If",
              less(subtract(at("k", "downs"), "k"), add("k", 1)),
              0,
              count(
                ["Range", "k", subtract(subtract(at("k", "downs"), "k"), 1)],
                test(count(upTo(["Length", "pu"]), and(less(at("q", "pd"), "k"), greater(at("q", "pu"), "c")), "q")),
                "c",
              ),
            ],
            "k",
          ),
        ),
      ),
    ),
  );

/**
 * Dyck paths whose area sequence stays on one side of this path's. The area sequence starts at 0
 * and rises by at most 1, so one pass along this path's own sequence suffices: the carried list
 * holds, at entry v+1, how many prefixes end at value v. A next value w may follow any v >= w-1,
 * and `keeps` decides whether w respects this path's entry.
 */
const areaSequenceBounded = (keeps: (next: MathJSON, bound: MathJSON) => MathJSON): MathJSON => [
  "If",
  less(semilength, 2),
  1,
  bind("s", areaSequence, [
    "Sum",
    fold(
      forEach(["Range", 2, semilength], at("i", "s")),
      forEach(upTo(semilength), ["If", equals("w", 1), 1, 0], "w"),
      forEach(
        upTo(semilength),
        [
          "If",
          keeps(subtract("w", 1), visiting),
          ["Sum", forEach(["Range", ["Max", ["List", subtract("w", 1), 1]], semilength], at("u", "a"), "u")],
          0,
        ],
        "w",
      ),
    ),
  ]),
];

/**
 * Walks of the same length, up or down a step at a time, that stay weakly above this path. The
 * carried list holds, at entry d+1, how many prefixes sit d above the path. Against an up step a
 * walk's up step keeps d and its down step lowers it; against a down step its up step raises d
 * and its down step keeps it; below zero is dropped.
 */
const pathsWeaklyAbove: MathJSON = bind(
  "m",
  add(length(), 1),
  [
    "Sum",
    [
      "Fold",
      // The carried list is typed, so the compiled sum stays an integer rather than a complex number.
      [
        "Function",
        forEach(
          upTo("m"),
          [
            "If",
            equals(visiting, 1),
            add(at("w", "a"), ["If", less("w", "m"), at(add("w", 1), "a"), 0]),
            add(at("w", "a"), ["If", greater("w", 1), at(subtract("w", 1), "a"), 0]),
          ],
          "w",
        ),
        ["Typed", "a", "'list<integer>'"],
        "b",
      ],
      forEach(upTo("m"), ["If", equals("w", 1), 1, 0], "w"),
      x,
    ],
  ],
  "integer",
);

/** The bounce path's climbs weigh binomial(climb, 2) each: its area, as `Area` counts it. */
const bounceAreaStep: MathJSON = [
  "If",
  equals(carried(1), semilength),
  ["List", carried(1), carried(2), carried(3)],
  [
    "List",
    at(add(carried(1), 1), "ceilings"),
    add(carried(2), 1),
    add(carried(3), [
      "Divide",
      [
        "Multiply",
        subtract(at(add(carried(1), 1), "ceilings"), carried(1)),
        subtract(subtract(at(add(carried(1), 1), "ceilings"), carried(1)), 1),
      ],
      2,
    ]),
  ],
];
const bouncePathArea: MathJSON = bind("ceilings", bounceCeilings, [
  "At",
  fold(upTo(semilength), ["List", 0, 0, 0], bounceAreaStep),
  3,
]);

// The Delest-Viennot parallelogram polyomino of a Dyck path. Past the first up and the last down
// step, the steps pair up (2t, 2t+1); each pair is one step of each of the polyomino's two
// bounding paths: up-up is (north, east), down-down is (east, north), up-down is (east, east) and
// down-up is (north, north). One path is the odd steps then a final east step, the other an east
// step then the even steps reversed in kind (north for a down step). Column j is as tall as the
// two paths' j-th east steps are apart.
const polyominoNorthFirst: MathJSON = [
  "Join",
  forEach(upTo(semilength), step(subtract(["Multiply", 2, "i"], 1))),
  ["List", 0],
];
const polyominoEastFirst: MathJSON = [
  "Join",
  ["List", 0],
  forEach(upTo(semilength), subtract(1, step(["Multiply", 2, "i"]))),
];
/** Positions of the east steps of a path of `semilength + 1` steps. */
const eastSteps = (path: MathJSON): MathJSON => where(upTo(add(semilength, 1)), equals(at("i", path), 0));
/** Column heights, left to right, with the two paths bound as `north` and `east`. */
const withColumnHeights = (body: MathJSON): MathJSON =>
  bind(
    "north",
    polyominoNorthFirst,
    bind(
      "east",
      polyominoEastFirst,
      bind(
        "northEasts",
        eastSteps("north"),
        bind(
          "eastEasts",
          eastSteps("east"),
          bind(
            "columns",
            forEach(upTo(["Length", "northEasts"]), subtract(at("j", "northEasts"), at("j", "eastEasts")), "j"),
            body,
          ),
        ),
      ),
    ),
  );
/** Maximal runs of east steps in a path of `semilength + 1` steps. */
const eastRuns = (path: MathJSON): MathJSON =>
  sumOver(upTo(add(semilength, 1)), [
    "If",
    equals(at("i", path), 0),
    ["If", equals("i", 1), 1, ["If", equals(at(subtract("i", 1), path), 1), 1, 0]],
    0,
  ]);

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
    "Hills of size one: a hill of size k is k up steps then k down steps from the axis (`HillsOfSizeTwo`, `HillsOfSizeThree`).",
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
    "The whole squares between the path and the diagonal below it: the sum of the area sequence.",
    areaValue,
    "Haglund's area (FindStat St000012). Half of: the total of the heights after each step, less the semilength.",
  ),
  stat(
    "Coarea",
    "The complement of the area within the staircase: binomial(n, 2) less the area.",
    nonEmpty(subtract(triangle, areaValue)),
    "Zero for the highest path, UU...DD, whose area is binomial(n, 2).",
  ),
  stat("LongestAscent", "The longest run of consecutive up steps.", nonEmpty(longestRunOf(1))),
  stat("LongestDescent", "The longest run of consecutive down steps.", nonEmpty(longestRunOf(0))),

  stat(
    "Dinv",
    "The dinv statistic, read from the area sequence.",
    dinvValue,
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
    "The bounce statistic: the sum of the bounce points of the path that bounces from its end back toward the origin.",
    bounceValue,
    "FindStat St000005. (Bounce, Area) and (Area, Dinv) share the same bivariate distribution (see dyck-statistics.test.ts).",
  ),
  stat(
    "BounceCount",
    "The number of bounce points of the bounce path, not counting the two ends.",
    atLeast(2, subtract(bounceWalk(2), 1)),
  ),
  stat(
    "DinvDeficit",
    "The binomial(n, 2) less the area and the dinv: the boxes of the partition traced out by the path where leg minus arm is not 0 or 1.",
    nonEmpty(subtract(subtract(triangle, areaValue), dinvValue)),
  ),
  stat(
    "BounceDeficit",
    "The binomial(n, 2) less the area and the bounce.",
    nonEmpty(subtract(subtract(triangle, areaValue), bounceValue)),
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

  // ── more of FindStat's, again named after their descriptions ───────────────────────────────

  stat(
    "UpStepsAtEvenPositions",
    "Up steps at an even position, counting from 1.",
    nonEmpty(count(positions, and(isUp("i"), equals(["Mod", "i", 2], 0)))),
  ),
  stat(
    "UpperInteractions",
    "Over each valley, the shorter of the down run before it and the up run after it, summed: the factors of k down steps then k up steps.",
    interactions(0),
    "Over a valley, the shorter of the down run before it and the up run after it.",
  ),
  stat(
    "PyramidWeight",
    "Over each peak, the shorter of the up run before it and the down run after it, summed: the sizes of the maximal pyramids.",
    interactions(1),
  ),

  stat(
    "CenteredTunnels",
    "Tunnels (an up step with its matching down step) centered on the middle of the path: positions summing to the length plus one.",
    nonEmpty(tunnelCount(centered)),
  ),
  stat(
    "LeftTunnels",
    "Tunnels (an up step with its matching down step) left of the middle: positions summing to less than the length plus one.",
    nonEmpty(tunnelCount(leftOf)),
  ),
  stat(
    "NestedCenteredTunnelPairs",
    "Pairs of centered tunnels, one strictly inside the other.",
    nonEmpty(nestedTunnelPairs(centered)),
  ),
  stat(
    "NestedLeftTunnelPairs",
    "Pairs of left tunnels, one strictly inside the other.",
    nonEmpty(nestedTunnelPairs(leftOf)),
  ),
  stat(
    "ValleyTunnelSemilengthSum",
    "The sum of the semilengths of the tunnels that end at a valley.",
    hasPair(
      bind("m", matchingUps, [
        "Sum",
        forEach(valleyPositions, ["Divide", add(subtract("p", ["At", "m", "p"]), 1), 2], "p"),
      ]),
    ),
  ),
  stat(
    "CenteredMultitunnels",
    "Factorizations of the path into three parts, the middle one a Dyck path and the outer two of equal length.",
    nonEmpty(
      bind(
        "v",
        vertexProfile,
        count(
          upTo(semilength),
          and(equals(["At", "v", add(semilength, add("c", 1))], ["At", "v", add(subtract(semilength, "c"), 1)]), [
            "GreaterEqual",
            [
              "Min",
              forEach(
                ["Range", add(subtract(semilength, "c"), 1), add(semilength, add("c", 1))],
                ["At", "v", "j"],
                "j",
              ),
            ],
            ["At", "v", add(subtract(semilength, "c"), 1)],
          ]),
          "c",
        ),
      ),
    ),
  ),

  stat("RisesOfLengthTwo", "Rises (maximal runs of up steps) of length 2.", hasPair(risesWhere((r) => equals(r, 2)))),
  stat("RisesOfLengthThree", "Rises (maximal runs of up steps) of length 3.", hasPair(risesWhere((r) => equals(r, 3)))),
  stat(
    "RisesOfLengthAtLeastThree",
    "Rises (maximal runs of up steps) of length at least 3.",
    hasPair(risesWhere((r) => ["GreaterEqual", r, 3])),
  ),
  stat(
    "RunsOfLengthOne",
    "Maximal runs of equal steps that are a single step.",
    hasPair(sumOver(positions, ["Multiply", startsRun("i"), endsRun("i")])),
    'Counts runs of both kinds of step, up and down; FindStat\'s title, "single rises", is misleading.',
  ),
  stat(
    "RisesOfLengthOneAtOddHeight",
    "Rises of length 1 that start at an odd height.",
    atLeast(
      3,
      count(
        upTo(subtract(length(), 2)),
        and(and(isDown("i"), isUp(nextIndex)), and(isDown(add("i", 2)), equals(["Mod", heightAfter("i"), 2], 1))),
      ),
    ),
  ),

  stat(
    "PeakRectangleAreaSum",
    "The sum, over consecutive peaks, of the area of the rectangle they span with the valley between them.",
    hasPair(
      bind(
        "peaks",
        peakPositions,
        bind("valleys", valleyPositions, [
          "If",
          equals(["Length", "valleys"], 0),
          0,
          [
            "Sum",
            forEach(
              ["Range", 1, ["Length", "valleys"]],
              [
                "Multiply",
                subtract(["At", "valleys", "a"], ["At", "peaks", "a"]),
                subtract(["At", "peaks", add("a", 1)], ["At", "valleys", "a"]),
              ],
              "a",
            ),
          ],
        ]),
      ),
    ),
    "Positions are counted from 1; only differences enter.",
  ),
  stat(
    "SkewHookPositionSum",
    "The sum of the skew hook positions: after two up steps and a down step, the down step's rank among the down steps; after two down steps and an up step, the rank of the second down step.",
    atLeast(
      3,
      sumOver(
        ["Range", 3, length()],
        [
          "If",
          and(and(isUp(subtract("i", 2)), isUp(subtract("i", 1))), isDown("i")),
          downsUpTo("i"),
          [
            "If",
            and(and(isDown(subtract("i", 2)), isDown(subtract("i", 1))), isUp("i")),
            downsUpTo(subtract("i", 1)),
            0,
          ],
        ],
      ),
    ),
  ),
  stat(
    "DownStepMajorIndex",
    "The major index counting positions in down steps only: over each valley, the number of down steps up to and including its down step; summed.",
    hasPair(sumOver(valleyPositions, downsUpTo("i"))),
  ),
  stat(
    "UpStepMajorIndex",
    "The major index counting positions in up steps only: over each valley, the number of up steps up to its down step; summed.",
    hasPair(sumOver(valleyPositions, subtract("i", downsUpTo("i")))),
  ),

  stat(
    "LongestZigzag",
    "The length of the longest stretch of steps that alternate between up and down.",
    [
      "At",
      fold(
        x,
        ["List", 0, 0, 2],
        [
          "If",
          equals(carried(3), visiting),
          ["List", carried(1), 1, visiting],
          ["List", ["Max", ["List", carried(1), add(carried(2), 1)]], add(carried(2), 1), visiting],
        ],
      ),
      1,
    ],
    "Starts the count again at 1 on a repeated step; the accumulator is (best, current, previous step), with 2 for no previous step.",
  ),
  stat(
    "BicoloredMotzkinHeight",
    "The height of the bicolored Motzkin path made by reading the steps in pairs: two up steps rise, two down steps fall.",
    nonEmpty(["Divide", ["Max", forEach(upTo(semilength), heightAfter(["Multiply", 2, "i"]))], 2]),
  ),
  stat(
    "BicoloredMotzkinLevelSteps",
    "The level steps of that bicolored Motzkin path: pairs of steps with one up and one down.",
    nonEmpty(
      count(upTo(semilength), equals(add(step(subtract(["Multiply", 2, "i"], 1)), step(["Multiply", 2, "i"])), 1)),
    ),
  ),
  stat(
    "MinimalValleyHeight",
    "The lowest height of a valley, or the semilength if the path has none.",
    hasPair(
      bind("valleyHeights", forEach(valleyPositions, heightAfter("i")), [
        "If",
        equals(["Length", "valleyHeights"], 0),
        semilength,
        ["Min", "valleyHeights"],
      ]),
    ),
  ),
  stat(
    "HillsOfSizeTwo",
    "Occurrences of two up steps then two down steps, starting on the axis.",
    atLeast(4, count(upTo(subtract(length(), 3)), hillAt(2))),
  ),
  stat(
    "HillsOfSizeThree",
    "Occurrences of three up steps then three down steps, starting on the axis.",
    atLeast(6, count(upTo(subtract(length(), 5)), hillAt(3))),
  ),
  stat("MinimalPeakHeight", "The height of the lowest peak.", hasPair(["Min", peakHeights])),
  stat("PeakLeftToRightMaxima", "Peaks higher than every peak to their left.", hasPair(peakMaxima("Greater"))),
  stat(
    "WeakPeakLeftToRightMaxima",
    "Peaks at least as high as every peak to their left.",
    hasPair(peakMaxima("GreaterEqual")),
  ),
  stat(
    "BoxWeight",
    "The product, over the up steps, of one more than the number of down steps before it.",
    nonEmpty(["Product", forEach(where(positions, isUp("i")), add(1, downsUpTo("i")))], 1),
    "Follows FindStat's Sage code and its data, not its description: the description gives 4 for the path UUDD, the code and every stored value give 1.",
  ),
  stat(
    "MiddleNonRunHeight",
    "The height of the middle turning point: the middle one of the peaks and valleys, left to right.",
    hasPair(
      bind(
        "turns",
        forEach(where(upTo(subtract(length(), 1)), equals(add(step("i"), step(nextIndex)), 1)), heightAfter("i")),
        ["At", "turns", ["Divide", add(["Length", "turns"], 1), 2]],
      ),
    ),
  ),
  stat(
    "SymmetryDegree",
    "The number of step pairs, counting inward from the ends, at which the path agrees in height with its mirror image.",
    nonEmpty(
      bind(
        "v",
        vertexProfile,
        count(
          upTo(semilength),
          and(
            equals(
              ["At", "v", subtract(["Multiply", 2, "c"], 1)],
              ["At", "v", add(subtract(length(), subtract(["Multiply", 2, "c"], 3)), 0)],
            ),
            equals(["At", "v", ["Multiply", 2, "c"]], ["At", "v", add(subtract(length(), ["Multiply", 2, "c"]), 2)]),
          ),
          "c",
        ),
      ),
    ),
    'FindStat\'s "degree of symmetry".',
  ),
  // ── FindStat's second batch: counts, boxes under peaks, polyominoes ───────────────────────

  stat(
    "ParkingFunctionCount",
    "The parking functions supported by the path: semilength factorial over the product of the factorials of the rise lengths.",
    atLeast(2, ["Divide", factorialOf(semilength), ["Product", forEach(riseLengths, factorialOf("r"), "r")]], 1),
    "A parking function is a path with the cars of each column labeled; the labels must increase up each rise, which leaves n!/(r_1! r_2! ...) of them.",
  ),
  stat(
    "ValleyPositionSum",
    "The sum of the positions of the valleys: a down step followed by an up step.",
    hasPair(["Sum", valleyPositions]),
    "FindStat St000027, \"the major index of a Dyck path\"; the repo's `MajorIndex` on a Dyck path sums the peaks' positions instead.",
  ),
  stat(
    "InteractionDifference",
    "The pyramid weight less the upper interactions: lower interactions less upper interactions.",
    subtract(interactions(1), interactions(0)),
  ),
  stat(
    "NonFinalConstantRunsOfLengthAtLeastTwo",
    "Maximal runs of equal steps, at least two long, that are followed by a step of the other kind: the occurrences of two up steps then a down step, or two down steps then an up step.",
    add(occurrencesOf(1, 1, 0), occurrencesOf(0, 0, 1)),
  ),
  stat(
    "LongTunnels",
    "The longest sequences of consecutive tunnels: the semilength less the valleys.",
    hasPair(subtract(semilength, count(upTo(subtract(length(), 1)), and(isDown("i"), isUp(nextIndex))))),
    "Tunnels meet end to start exactly at valleys, and each valley joins one pair, so merging them leaves one long tunnel per tunnel not joined.",
  ),
  stat(
    "HalfMacMahonEqualIndex",
    "Half the sum of the positions of double rises and double falls.",
    hasPair(["Divide", ["Add", ["Sum", repeatsAt(1)], ["Sum", repeatsAt(0)]], 2]),
    "Half of `MacMahonEqualIndex`, which is even on a Dyck path.",
  ),
  stat(
    "BoxesBelowOnePeak",
    "The boxes between the path and the diagonal that lie right of and below exactly one peak.",
    boxesBelowPeaks((peaks) => equals(peaks, 1)),
  ),
  stat(
    "BoxesBelowAtLeastTwoPeaks",
    "The boxes between the path and the diagonal that lie right of and below at least two peaks.",
    boxesBelowPeaks((peaks) => ["GreaterEqual", peaks, 2]),
  ),
  stat(
    "DoubleStepVisiblePoints",
    "Points below the path, at the parity of the path's height there, from which the north-east diagonal meets a double fall and the north-west diagonal meets a double rise.",
    hasPair(
      bind(
        "vp",
        vertexProfile,
        bind(
          "doubleRises",
          forEach(repeatsAt(1), add("i", heightAfter("i"))),
          bind(
            "doubleFalls",
            forEach(repeatsAt(0), subtract("i", heightAfter("i"))),
            sumOver(
              ["Range", 0, length()],
              bind(
                "h",
                at(add("v", 1), "vp"),
                [
                  "If",
                  less("h", 2),
                  0,
                  count(
                    ["Range", 1, "h"],
                    and(
                      atMostValue(["Multiply", 2, "m"], "h"),
                      and(
                        greater(
                          count("doubleRises", equals("s", add("v", subtract("h", ["Multiply", 2, "m"]))), "s"),
                          0,
                        ),
                        greater(
                          count("doubleFalls", equals("s", subtract("v", subtract("h", ["Multiply", 2, "m"]))), "s"),
                          0,
                        ),
                      ),
                    ),
                    "m",
                  ),
                ],
                "number",
              ),
              "v",
            ),
          ),
        ),
      ),
    ),
    "A point (v, j) has j = h - 2m under the path's vertex v of height h. Its north-east diagonal meets the path at a double fall (v, h') with v - j = v' - h'; its north-west diagonal at a double rise with v + j = v' + h'.",
  ),
  stat(
    "AreaAboveBouncePath",
    "The boxes between the path and its bounce path: the area less the area of the bounce path.",
    atLeast(2, subtract(areaValue, bouncePathArea)),
    "The bounce path is U^b1 D^b1 U^b2 D^b2 ... for the climbs b of the bounce walk, so its area is the sum of binomial(b, 2).",
  ),
  stat(
    "WeaklyBelowDyckPathCount",
    "The Dyck paths of the same semilength weakly below this path, itself included.",
    areaSequenceBounded((next, bound) => atMostValue(next, bound)),
    "Weakly below: each entry of the area sequence is at most this path's.",
  ),
  stat(
    "ProperlyBelowDyckPathCount",
    "The Dyck paths of the same semilength weakly below this path, itself excluded.",
    subtract(
      areaSequenceBounded((next, bound) => atMostValue(next, bound)),
      1,
    ),
  ),
  stat(
    "WeaklyAboveDyckPathCount",
    "The Dyck paths of the same semilength weakly above this path, itself included.",
    areaSequenceBounded((next, bound) => atLeastValue(next, bound)),
  ),
  stat(
    "ProperlyAboveDyckPathCount",
    "The Dyck paths of the same semilength weakly above this path, itself excluded.",
    subtract(
      areaSequenceBounded((next, bound) => atLeastValue(next, bound)),
      1,
    ),
  ),
  stat(
    "WeaklyAboveLatticePathCount",
    "The up-and-down paths of the same length, ending anywhere, that stay weakly above this path.",
    nonEmpty(pathsWeaklyAbove, 1),
    "The paths need not return to the axis: `2^n` for the highest path, the central binomial coefficient for the zigzag.",
  ),

  stat(
    "NorthStepOrderingCount",
    "The total orderings of the up steps such that the up steps after the k-th down step are never among the first k in the order.",
    atLeast(
      4,
      bind("us", forEach(upTo(semilength), subtract(at("k", where(positions, isDown("i"))), "k"), "k"), [
        "Product",
        forEach(
          ["Range", 1, subtract(semilength, 1)],
          [
            "Divide",
            subtract(at("k", "us"), subtract("k", 1)),
            bind(
              "t",
              ["If", equals("k", 1), at(1, "us"), subtract(at("k", "us"), at(subtract("k", 1), "us"))],
              factorialOf("t"),
              "integer",
            ),
          ],
          "k",
        ),
      ]),
      1,
    ),
    "The coefficient of z_1^a_1 ... z_n^a_n in the product of (z_1 + ... + z_k), by Stanley's product formula: each factor is the height before a down step over the factorial of the up steps since the last one.",
  ),
  stat(
    "ThreeCatalanPathCount",
    "The paths from the origin to (n, n, n) with x >= y >= z whose first two coordinates trace this Dyck path and whose last two coordinates trace it as well.",
    atLeast(
      4,
      bind(
        "ups",
        where(positions, isUp("i")),
        bind("downs", where(positions, isDown("i")), [
          "Product",
          forEach(
            ["Range", 1, subtract(semilength, 1)],
            bind(
              "r",
              subtract(subtract(at(add("k", 1), "ups"), at("k", "ups")), 1),
              bind(
                "s",
                subtract(subtract(at(add("k", 1), "downs"), at("k", "downs")), 1),
                ["Divide", factorialOf(add("r", "s")), ["Multiply", factorialOf("r"), factorialOf("s")]],
                "integer",
              ),
              "integer",
            ),
            "k",
          ),
        ]),
      ),
      1,
    ),
    "With r the downs between consecutive up steps and s the ups between consecutive down steps, the product over consecutive pairs of binomial(r + s, r).",
  ),

  stat(
    "ParallelogramPolyominoArea",
    "The cells of the parallelogram polyomino the path corresponds to under the Delest-Viennot bijection.",
    nonEmpty(withColumnHeights(["Sum", "columns"])),
  ),
  stat(
    "ParallelogramPolyominoNormalizedArea",
    "The area of the parallelogram polyomino less the semilength: the cells beyond the smallest polyomino.",
    nonEmpty(withColumnHeights(subtract(["Sum", "columns"], semilength))),
  ),
  stat(
    "ParallelogramPolyominoMinimalColumnHeight",
    "The height of the shortest column of the parallelogram polyomino.",
    nonEmpty(withColumnHeights(["Min", "columns"])),
  ),
  stat(
    "ParallelogramPolyominoMaximalColumnHeight",
    "The height of the tallest column of the parallelogram polyomino.",
    nonEmpty(withColumnHeights(["Max", "columns"])),
  ),
  stat(
    "ParallelogramPolyominoInnerCorners",
    "The inner corners of the parallelogram polyomino: the turns from east to north on its two bounding paths, not counting the corners every polyomino has.",
    nonEmpty(
      bind(
        "north",
        polyominoNorthFirst,
        bind("east", polyominoEastFirst, subtract(add(eastRuns("north"), eastRuns("east")), 2)),
      ),
    ),
  ),
  stat(
    "ParallelogramPolyominoUpperInnerCorners",
    "The inner corners of the polyomino's upper path: its turns from east to north, not counting the first.",
    nonEmpty(bind("east", polyominoEastFirst, subtract(eastRuns("east"), 1))),
    "The upper path of FindStat's polyomino is the one that opens with an east step here, up to reflecting the polyomino in the diagonal.",
  ),
];
