import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `Range`'s `collection` handlers (`iterator`, `at`, `count`) read
// their bounds through `range()` (`library/collections.ts`), which converts every operand to
// a plain JS `number` up front. An exact rational step then materializes as a double:
// `Range(0, 3, 1/3)` holds 0.3333333333333333, not the exact thirds. `count` mostly survives
// this (its `rangeCount` quotient carries a tolerance for exactly this rounding), but the
// ELEMENTS never get a second chance -- `lower + step*(index-1)` is computed in floating
// point every time. Fixed here by re-deriving the elements (and, for full exactness, the
// count) from bigint rationals whenever the bounds and step are exact, and falling back to
// the native double-based handlers for anything symbolic, irrational, or non-finite (an
// unbounded `+oo`/`-oo` endpoint has no rounding to absorb in the first place).

/** A reduced rational `[numerator, denominator]`, `denominator > 0`. */
type Rat = readonly [bigint, bigint];

const ZERO: Rat = [0n, 1n];

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};

const normalize = ([n, d]: readonly [bigint, bigint]): Rat => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return [n / g, d / g];
};

const add = (a: Rat, b: Rat): Rat => normalize([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const sub = (a: Rat, b: Rat): Rat => normalize([a[0] * b[1] - b[0] * a[1], a[1] * b[1]]);
const scaleInt = (a: Rat, k: bigint): Rat => normalize([a[0] * k, a[1]]);
const isZero = (a: Rat): boolean => a[0] === 0n;

/** -1, 0 or 1 as `a` is less than, equal to, or greater than `b`. Both have `denominator > 0`. */
const compare = (a: Rat, b: Rat): number => {
  const l = a[0] * b[1];
  const r = b[0] * a[1];
  return l < r ? -1 : l > r ? 1 : 0;
};

/** ⌊n/d⌋ for d > 0. */
const floorDiv = (n: bigint, d: bigint): bigint => {
  const q = n / d; // truncates toward zero
  return n % d !== 0n && n < 0n ? q - 1n : q;
};

/** ⌊a⌋ for a rational with a positive denominator. */
const floorRat = (a: Rat): bigint => floorDiv(a[0], a[1]);

/** The k-th element (0-based) of the arithmetic sequence `lower, lower + step, …`. */
const elementAt = (lower: Rat, step: Rat, k: bigint): Rat => add(lower, scaleInt(step, k));

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const intJson = (v: bigint): number | { num: string } =>
  v >= MIN_SAFE && v <= MAX_SAFE ? Number(v) : { num: v.toString() };

const ratToBoxed = (ce: ComputeEngine, r: Rat): BoxedExpression =>
  r[1] === 1n ? ce.box(intJson(r[0]) as never) : ce.box(["Rational", intJson(r[0]), intJson(r[1])] as never);

/**
 * Element count of the exact arithmetic range `lower, lower + step, …` up to (and including,
 * on the grid) `upper`. Mirrors compute-engine's own `rangeCount` (same file, `range-count.ts`)
 * except there is no rounding to tolerate: the quotient is exact, so the grid-point check that
 * `rangeCount`'s tolerance exists to absorb never applies.
 */
function exactCount(lower: Rat, upper: Rat, step: Rat): number {
  if (isZero(step)) return 0;
  const diff = sub(upper, lower);
  if (isZero(diff)) return 1; // upper === lower: always one element, whichever way step points
  if (compare(step, ZERO) !== compare(diff, ZERO)) return 0; // step points away from upper
  const q = normalize([diff[0] * step[1], diff[1] * step[0]]); // (upper - lower) / step, positive
  return Number(floorRat(q) + 1n);
}

/**
 * `lower` and `step` as exact rationals, for a canonical `Range` call (2 operands: `lower,
 * upper`, implicit step `±1`; 3 operands: `lower, upper, step`). `undefined` when either is
 * not an exact rational -- symbolic, irrational, or non-finite -- in which case the native
 * double-based handlers already answer correctly (or as correctly as a real number allows).
 *
 * The implicit step of a 2-operand `Range` needs only the DIRECTION toward `upper`, never its
 * magnitude, so this still returns an exact `lower` for `Range(1/3, +oo)`: the upper bound does
 * not have to be exact rational itself, only comparable.
 */
function exactBounds(expr: BoxedExpression): { lower: Rat; step: Rat } | undefined {
  const ops = operandsOf(expr);
  const lower = bigRationalAt(ops[0]);
  if (lower === undefined) return undefined;
  if (ops.length >= 3) {
    const step = bigRationalAt(ops[2]);
    return step === undefined ? undefined : { lower, step };
  }
  const upper = bigRationalAt(ops[1]);
  const lowerNum = Number(lower[0]) / Number(lower[1]);
  // `ops[1]` may still be an unevaluated call (`PrimePi(100)`, not yet the `25` it
  // denotes) -- `.re` on that is NaN, not a number to compare. `.N()` is what native's own
  // `range()` reads the bound through (`operandNumericValue`, collections.ts), and forces
  // exactly the evaluation `.re` alone does not.
  const ascending = upper !== undefined ? compare(upper, lower) >= 0 : (ops[1]?.N().re ?? NaN) >= lowerNum;
  return { lower, step: ascending ? [1n, 1n] : [-1n, 1n] };
}

/** `exactBounds` plus an exact `upper`, for `count` -- which, unlike element generation, does
 * need the upper bound's own value, not just its direction. */
function exactRange(expr: BoxedExpression): { lower: Rat; upper: Rat; step: Rat } | undefined {
  const bounds = exactBounds(expr);
  if (bounds === undefined) return undefined;
  const upper = bigRationalAt(operandsOf(expr)[1]);
  return upper === undefined ? undefined : { ...bounds, upper };
}

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;
type CollectionHandlers = NonNullable<OperatorDefinition["collection"]>;

/** Patch `Range`'s `count`, `iterator` and `at` collection handlers to compute exact
 * rationals from exact bounds, in place -- every other handler (`contains`, `eltsgn`,
 * `subsetOf`, …), and the native handlers for symbolic/irrational/infinite bounds, are kept. */
export function evaluateRangeWithRationalStep(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Range");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const collection = operator.collection as CollectionHandlers | undefined;
  if (collection === undefined) return;
  const nativeIterator = collection.iterator;
  const nativeAt = collection.at;
  const nativeCount = collection.count;

  // Read through `collection.count` (not `nativeCount`) below: once this runs, that property
  // is this function, so `iterator`/`at` pick up the exact count too, not just the native one.
  collection.count = (expr) => {
    const r = exactRange(expr);
    return r === undefined ? nativeCount(expr) : exactCount(r.lower, r.upper, r.step);
  };

  collection.iterator = (expr) => {
    const bounds = exactBounds(expr);
    if (bounds === undefined) return nativeIterator(expr);
    const maxCount = collection.count(expr);
    if (maxCount === undefined || Number.isNaN(maxCount)) return nativeIterator(expr);
    let index = 0;
    return {
      next: () => {
        if (index >= maxCount) return { value: undefined, done: true };
        const value = ratToBoxed(expr.engine, elementAt(bounds.lower, bounds.step, BigInt(index)));
        index += 1;
        return { value, done: false };
      },
    };
  };

  collection.at = (expr, index) => {
    if (typeof index !== "number" || !Number.isFinite(index)) return nativeAt?.(expr, index as never);
    const bounds = exactBounds(expr);
    if (bounds === undefined) return nativeAt?.(expr, index);
    const maxCount = collection.count(expr);
    if (maxCount === undefined || index < 1 || index > maxCount) return undefined;
    return ratToBoxed(expr.engine, elementAt(bounds.lower, bounds.step, BigInt(index - 1)));
  };
}
