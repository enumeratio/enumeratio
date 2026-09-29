// Reference definitions — each permutation statistic written AS AN EXPRESSION, over the
// wildcard `_p`, in terms of heads compute-engine already has.
//
// These are not what runs; `stats.ts` holds the fast loops and those stay the
// implementation. What these are for (design/namespaces.md §6):
//
//   1. they SAY what the statistic means, in a form a reader can expand and evaluate;
//   2. they are a differential oracle for the fast version — `tests/definitions.test.ts`
//      checks the two agree over every permutation of 1..6, which is what stops a second
//      implementation from rotting;
//   3. they place each head against the primitive frontier: everything here reduces to
//      Count / Filter / Map / Sum / Range / Length / At / Max / Take and comparisons, and
//      nothing else. `CycleCount` does not reduce at all — see PRIMITIVE below.

import type { MathJSON } from "@enumeratio/entry";

const length: MathJSON = ["Length", "_p"];
/** Positions `1 .. n`. */
const positions: MathJSON = ["Range", 1, length];
/** Positions with a successor, `1 .. n-1`. */
const interior: MathJSON = ["Range", 1, ["Subtract", length, 1]];
/** Positions with both neighbours, `2 .. n-1`. */
const strictInterior: MathJSON = ["Range", 2, ["Subtract", length, 1]];

const at = (index: MathJSON): MathJSON => ["At", "_p", index];
const here = at("i");
const next = at(["Add", "i", 1]);
const previous = at(["Subtract", "i", 1]);

/** The elements of `over` for which `predicate` holds, binding them to `variable`. */
const where = (over: MathJSON, predicate: MathJSON, variable = "i"): MathJSON => [
  "Filter",
  over,
  ["Function", predicate, variable],
];
const howMany = (over: MathJSON, predicate: MathJSON, variable = "i"): MathJSON => [
  "Count",
  where(over, predicate, variable),
];

// `Range(1, 0)` does not evaluate to the empty list — it stays symbolic, and Filter then
// rejects it. So each definition states its own floor, which is worth saying anyway: a
// permutation too short to have the feature has none of it.
const ifAtLeast = (n: number, body: MathJSON): MathJSON => ["If", ["Less", length, n], 0, body];
const perPosition = (body: MathJSON): MathJSON => ifAtLeast(1, body);
const perAdjacentPair = (body: MathJSON): MathJSON => ifAtLeast(2, body);
const perInteriorPoint = (body: MathJSON): MathJSON => ifAtLeast(3, body);

const fallsAfter: MathJSON = ["Greater", here, next];
const risesAfter: MathJSON = ["Less", here, next];

export const DEFINITIONS: Readonly<Record<string, MathJSON>> = {
  Descents: perAdjacentPair(howMany(interior, fallsAfter)),
  Ascents: perAdjacentPair(howMany(interior, risesAfter)),

  // Not the COUNT of descents but the SUM of their positions. That distinction is the
  // entire content of the statistic, and it is visible here in a way prose struggles with.
  MajorIndex: perAdjacentPair(["Sum", where(interior, fallsAfter)]),
  MinorIndex: perAdjacentPair(["Sum", where(interior, risesAfter)]),

  FixedPoints: perPosition(howMany(positions, ["Equal", here, "i"])),
  Excedances: perPosition(howMany(positions, ["Greater", here, "i"])),
  Antiexcedances: perPosition(howMany(positions, ["Less", here, "i"])),

  Peaks: perInteriorPoint(howMany(strictInterior, ["And", ["Less", previous, here], ["Greater", here, next]])),
  Valleys: perInteriorPoint(howMany(strictInterior, ["And", ["Greater", previous, here], ["Less", here, next]])),

  /** A left-to-right maximum: nothing before it is larger. */
  Records: perPosition(howMany(positions, ["Equal", here, ["Max", ["Take", "_p", "i"]]])),

  /** Pairs out of order, counted as: for each i, how many later entries it dominates. */
  Inversions: perAdjacentPair([
    "Sum",
    [
      "Map",
      // The inner filter binds `j`, so the outer `i` stays visible inside it.
      ["Function", howMany(["Range", ["Add", "i", 1], length], ["Greater", here, at("j")], "j"), "i"],
      positions,
    ],
  ]),
};

/**
 * Heads that do NOT reduce, with the reason — the primitive frontier for this package
 * (design/namespaces.md §6.1). Being on it is a claim to be justified, not a place to put
 * anything inconvenient.
 */
export const PRIMITIVE: Readonly<Record<string, string>> = {
  // Orbit traversal with a visited set. Expressible in principle, unreadable in practice,
  // and the tree would teach a reader nothing the loop does not.
  CycleCount: "kernel",
};
