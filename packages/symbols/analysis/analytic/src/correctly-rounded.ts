import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { lower, upper } from "./ball.ts";
import { enclosure } from "./certified.ts";
import { DOUBLE_DIGITS } from "./precise.ts";

// `N(x, d)`: `x` to `d` significant digits, every one of them right -- the last included.
//
// compute-engine evaluates `x` at `d` digits and hands that back. Each step of the evaluation
// rounds, so the result can be a unit or so off in its last place, and when the true value sits
// near a rounding boundary that is enough to tip the last digit the wrong way (Arcsin(1/3),
// Sinh(1), ln Γ(1/3) at 30 digits all did). Some heads also return more digits than asked
// (DirichletBeta gave 85 for 40), and `N(x, d)` left the engine's working precision at `d`
// for every later evaluation.
//
// Ziv's loop fixes the digits: evaluate at `d + 2g` digits and again at `d + g`, round both to
// `d`, and answer when they agree -- like measuring twice with finer rulers and writing down
// only the digits both readings share. When they disagree the true value is close to a
// boundary, so the guard `g` doubles and the loop measures again. Agreement is evidence, not
// proof: in principle both readings could be wrong the same way.
//
// A head that bounds its own error proves its digits instead (enumeratio/enumeratio#113,
// step 3 (b); certified.ts lists them). On exact arguments its kernel returns an enclosure,
// a ball that provably holds the value, at `d + g` digits: when both ends of it round to the
// same `d` digits, every value between them does too, the true one among them. When they
// don't, the guard doubles, as above; no agreement is consulted on this path. Only a value
// within the finest ball's width of a rounding boundary -- or on one -- falls through to the
// agreement loop, which answers without a certificate. `enclosureOf(result)` hands back the
// enclosure a certified answer was rounded from.
//
// A head that ignores the working precision and answers with a double (15-17 digits, however
// many were asked for) cannot be measured more finely, so the loop can't vouch for more digits
// than a double carries. Up to 15 digits its double is rounded like any reading; past that its
// call is left to compute-engine's `N`, unrounded, so the gap stays visible.
//
// Ties -- a value exactly halfway, only possible for a terminating decimal like `N(1/8, 2)` --
// round to even (0.12), as compute-engine's own rounding, IEEE 754 and Wolfram's `Round` do.
//
// The finest reading the loop took is kept beside the answer: `refinementOf(result)` hands it
// back, so a later calculation can start from those digits rather than recompute them.

/** The first guard, in digits beyond those asked for. */
const FIRST_GUARD = 10;

/** Doublings of the guard before the loop settles for its finest reading: `d + 320` digits. */
const MAX_DOUBLINGS = 4;

/** compute-engine's own ceiling on the digits `N` will be asked for. */
const MAX_DIGITS = 1000;

/** The finest reading each answer was rounded from. Weak, so it lives as long as the answer. */
const refinements = new WeakMap<BoxedExpression, BoxedExpression>();

/** The enclosure each certified answer was rounded from. */
const enclosures = new WeakMap<BoxedExpression, BoxedExpression>();

/** The enclosure `result` -- an answer of `N(x, d)` -- was proven from, an `Interval` whose
 * ends both round to `result`; `undefined` for an answer resting on agreement alone, or
 * anything else. Its presence is the certificate. */
export function enclosureOf(result: BoxedExpression): BoxedExpression | undefined {
  return enclosures.get(result);
}

/** The reading `result` -- an answer of `N(x, d)` -- was rounded from, carrying the loop's extra
 * guard digits; `undefined` for anything else. Those digits agreed with a coarser reading only
 * up to the `d`th, so they are a head start, not a promise. */
export function refinementOf(result: BoxedExpression): BoxedExpression | undefined {
  return refinements.get(result);
}

type BigDecimal = ReturnType<ComputeEngine["bignum"]>;

/** A MathJSON number leaf's value -- a double (`0.5`) or a decimal (`{ num: "0.5…" }`) -- or
 * `undefined` for any other node, an integer, or a non-finite number. Integers are left
 * alone: in a numeric result they are exponents, counts and exact values, not readings. */
function leafOf(ce: ComputeEngine, node: unknown): BigDecimal | undefined {
  const text =
    typeof node === "number"
      ? String(node)
      : typeof node === "object" &&
          node !== null &&
          typeof (node as { num?: unknown }).num === "string"
        ? (node as { num: string }).num
        : undefined;
  if (text === undefined) return undefined;
  const value = ce.bignum(text);
  return value.isFinite() && !value.isInteger() ? value : undefined;
}

/** Significant digits a decimal carries. */
const digitsOf = (x: BigDecimal): number =>
  (x.significand < 0n ? -x.significand : x.significand).toString().length;

/** `json` with every inexact number leaf -- a real, or either part of a `Complex` -- rounded to
 * `d` significant digits, ties to even. A list or a symbolic result (`x + 3.14159…`) is
 * rounded leaf by leaf. */
function roundedTree(ce: ComputeEngine, json: unknown, d: number): unknown {
  if (Array.isArray(json)) return json.map((node) => roundedTree(ce, node, d));
  const leaf = leafOf(ce, json);
  return leaf === undefined ? json : { num: leaf.toPrecision(d).toString() };
}

/** Did a head behind `json` answer with a double, ignoring the precision it was asked for?
 * Its digits then stop at a double's 15-17 however far the precision is raised, where a
 * precision-honouring head's fill the precision -- unless the value terminates early, as 1/8
 * does, which leaves far fewer digits than a double's. */
function hasDoubleOnly(ce: ComputeEngine, json: unknown, precision: number): boolean {
  if (Array.isArray(json)) return json.some((node) => hasDoubleOnly(ce, node, precision));
  const leaf = leafOf(ce, json);
  if (leaf === undefined) return false;
  const digits = digitsOf(leaf);
  return digits >= DOUBLE_DIGITS && digits < precision - FIRST_GUARD;
}

/** `x` to `d` digits proven by its enclosure, or `undefined` when `x` has none or it can't
 * decide them within the guard's doublings. */
function certifiedRounding(
  ce: ComputeEngine,
  x: BoxedExpression,
  d: number,
): BoxedExpression | undefined {
  for (let guard = FIRST_GUARD, doubling = 0; doubling <= MAX_DOUBLINGS; guard *= 2, doubling++) {
    const ball = enclosure(x, d + guard);
    if (ball === undefined) return undefined;
    const answer = lower(ball).toPrecision(d);
    if (!answer.eq(upper(ball).toPrecision(d))) continue;
    const result = ce.box({ num: answer.toString() });
    refinements.set(result, ce.number(ball.mid));
    const ends = [
      lower(ball).toPrecisionToward(d + guard, "floor"),
      upper(ball).toPrecisionToward(d + guard, "ceiling"),
    ];
    enclosures.set(result, ce.box(["Interval", ...ends.map((end) => ({ num: end.toString() }))]));
    return result;
  }
  return undefined;
}

/** `x` to `d` digits by Ziv's loop, or `undefined` when the loop can't vouch for them because
 * more digits are asked for than a double holds and a head in it answers with one. Leaves
 * `ce.precision` changed; the caller restores it. */
function correctlyRounded(
  ce: ComputeEngine,
  x: BoxedExpression,
  d: number,
): BoxedExpression | undefined {
  const reading = (precision: number): BoxedExpression => {
    ce.precision = precision;
    return x.N();
  };
  const certified = certifiedRounding(ce, x, d);
  if (certified !== undefined) return certified;
  const key = (v: BoxedExpression): string => JSON.stringify(roundedTree(ce, v.json, d));
  // The finer reading first: a kernel that caches what it computes at the most digits it has
  // been asked for (bigzeta.ts's coefficients, barnes-g-big.ts's ζ values) then serves the
  // coarser one by rounding, rather than recomputing everything one precision up.
  let guard = FIRST_GUARD;
  let finest = reading(d + 2 * guard);
  if (d > DOUBLE_DIGITS && hasDoubleOnly(ce, finest.json, d + 2 * guard)) return undefined;
  let answer = key(finest);
  let agreed = key(reading(d + guard)) === answer;
  for (let doubling = 0; !agreed && doubling < MAX_DOUBLINGS; doubling++) {
    guard *= 2;
    finest = reading(d + 2 * guard);
    const next = key(finest);
    agreed = next === answer;
    answer = next;
  }
  const result = ce.box(JSON.parse(answer) as never);
  refinements.set(result, finest);
  return result;
}

/** Route `N(x, d)` through Ziv's loop, and leave the working precision as it found it. */
export function declareCorrectlyRoundedN(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("N");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate;
  // `N` holds its arguments, so `x` arrives unevaluated: it is evaluated numerically below, at
  // each precision, and never exactly first.
  operator.evaluate = (ops, options) => {
    const precision = ce.precision;
    try {
      const d = ops.length === 2 ? ops[1]!.canonical.N().re : NaN;
      if (Number.isFinite(d) && d >= 1) {
        const answer = correctlyRounded(ce, ops[0]!.canonical, Math.min(Math.trunc(d), MAX_DIGITS));
        if (answer !== undefined) return answer;
        ce.precision = precision;
      }
      return native?.(ops, options);
    } finally {
      ce.precision = precision;
    }
  };
}
