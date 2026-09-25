// The small expression vocabulary every definition is written in. Keeping the builders here
// rather than inlining MathJSON keeps the definitions readable AND keeps the primitive
// frontier visible: whatever this file bottoms out in is what the whole package reduces to.

import { type MathJSON, SUBJECT } from "./types.ts";

export const x: MathJSON = SUBJECT;

export const length = (of: MathJSON = x): MathJSON => ["Length", of];
export const at = (index: MathJSON, of: MathJSON = x): MathJSON => ["At", of, index];
export const add = (a: MathJSON, b: MathJSON): MathJSON => ["Add", a, b];
export const subtract = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];

/** `1 .. n`, the positions of a sequence of length n. */
export const upTo = (n: MathJSON): MathJSON => ["Range", 1, n];
/** Positions of `_x`: `1 .. Length(_x)`. */
export const positions: MathJSON = upTo(length());
/** Positions with a successor: `1 .. Length(_x) - 1`. */
export const adjacent: MathJSON = upTo(subtract(length(), 1));
/** Positions with both neighbours: `2 .. Length(_x) - 1`. */
export const interior: MathJSON = ["Range", 2, subtract(length(), 1)];

/** The elements of `over` satisfying `predicate`, bound to `variable`. */
export const where = (over: MathJSON, predicate: MathJSON, variable = "i"): MathJSON => [
  "Filter",
  over,
  ["Function", predicate, variable],
];
/** How many elements of `over` satisfy `predicate`. */
export const count = (over: MathJSON, predicate: MathJSON, variable = "i"): MathJSON => [
  "Count",
  where(over, predicate, variable),
];
/** `body` evaluated at each element of `over`, as a list. */
export const forEach = (over: MathJSON, body: MathJSON, variable = "i"): MathJSON => [
  "Map",
  ["Function", body, variable],
  over,
];
/**
 * `body` with `name` bound to `value` — a `let`, spelled as a lambda applied to its argument.
 *
 * The one thing the helpers in this file cannot otherwise express. A sub-term shared by
 * several places in a definition is embedded by VALUE at each of them, and compute-engine
 * does no common-subexpression elimination: a list built inside the inner loop of a pairwise
 * scan is rebuilt at every reference, every iteration. Binding it here evaluates `value`
 * once and substitutes the result — `Crossings` on a set partition of [6] went from 430ms to
 * 24ms, same answer. Use it for anything non-trivial that is read more than once.
 */
export const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => [
  "Apply",
  ["Function", body, name],
  value,
];
/** The sum of `body` over `over`. */
export const sumOver = (over: MathJSON, body: MathJSON, variable = "i"): MathJSON => [
  "Sum",
  forEach(over, body, variable),
];

// `Range(1, 0)` does not evaluate to the empty list — it stays symbolic, and Filter then
// rejects it. Every definition over positions therefore states its own floor, which is worth
// saying anyway: a structure too short to have the feature has none of it.
export const atLeast = (n: number, body: MathJSON, otherwise: MathJSON = 0): MathJSON => [
  "If",
  ["Less", length(), n],
  otherwise,
  body,
];
/** Guard for a definition that needs at least one position. */
export const nonEmpty = (body: MathJSON, otherwise: MathJSON = 0): MathJSON => atLeast(1, body, otherwise);
/** Guard for a definition that reads adjacent pairs. */
export const hasPair = (body: MathJSON, otherwise: MathJSON = 0): MathJSON => atLeast(2, body, otherwise);
/** Guard for a definition that reads a position and both its neighbours. */
export const hasTriple = (body: MathJSON, otherwise: MathJSON = 0): MathJSON => atLeast(3, body, otherwise);

// Comparisons, named for what they mean at a position i of a sequence.
export const here = at("i");
export const next = at(add("i", 1));
export const previous = at(subtract("i", 1));
export const fallsAfter: MathJSON = ["Greater", here, next];
export const risesAfter: MathJSON = ["Less", here, next];

export const max = (of: MathJSON): MathJSON => ["Max", of];
export const min = (of: MathJSON): MathJSON => ["Min", of];
export const take = (n: MathJSON, of: MathJSON = x): MathJSON => ["Take", of, n];
export const and = (a: MathJSON, b: MathJSON): MathJSON => ["And", a, b];
export const or = (a: MathJSON, b: MathJSON): MathJSON => ["Or", a, b];
export const equals = (a: MathJSON, b: MathJSON): MathJSON => ["Equal", a, b];
export const greater = (a: MathJSON, b: MathJSON): MathJSON => ["Greater", a, b];
export const less = (a: MathJSON, b: MathJSON): MathJSON => ["Less", a, b];
export const atLeastValue = (a: MathJSON, b: MathJSON): MathJSON => ["GreaterEqual", a, b];
export const atMostValue = (a: MathJSON, b: MathJSON): MathJSON => ["LessEqual", a, b];

/** The values at positions `from .. to`, as a list. `Drop`/`Most` do not evaluate on a
 *  plain List in 0.128, so slices are built by mapping over a range of indices. */
export const slice = (from: MathJSON, to: MathJSON): MathJSON => forEach(["Range", from, to], at("j"), "j");
/** The values from position `i` to the end. */
export const fromHere: MathJSON = slice("i", length());
/** The values up to and including position `i`. */
export const upToHere: MathJSON = slice(1, "i");
/** |a - b|. */
export const distance = (a: MathJSON, b: MathJSON): MathJSON => ["Abs", subtract(a, b)];

/**
 * A fold over `over`, carrying `initial` through `step`. `step` sees the accumulator as `a`
 * and the current element as `b`.
 *
 * This is the form that makes prefix-dependent statistics expressible — longest run, and
 * anything else that has to carry state along the sequence. Worth stating plainly because
 * an earlier version of this package declared such statistics irreducible on the grounds
 * that compute-engine had no fold; it has one, and the claim was simply wrong.
 */
export const fold = (over: MathJSON, initial: MathJSON, step: MathJSON, accumulator = "a", element = "b"): MathJSON => [
  "Fold",
  ["Function", step, accumulator, element],
  initial,
  over,
];
/** Field `n` of a list accumulator. */
export const carried = (n: number): MathJSON => ["At", "a", n];
/** The element the fold is currently visiting. */
export const visiting: MathJSON = "b";
