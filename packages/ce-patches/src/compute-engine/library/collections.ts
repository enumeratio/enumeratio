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

// cortex-js/compute-engine: `Take`/`Drop`'s `collection` handlers (`at`, `iterator`, `count`,
// and `Take`'s own `isEmpty`) all read the count operand through a `Math.max(0, count)` clamp
// -- a negative count reads as zero, not "count from the end": `Take(xs, -n)` answers `[]`
// instead of the last `n` elements, and `Drop(xs, -n)` answers `xs` unchanged instead of all
// but the last `n`. Wolfram's `Take[l, -n]`/`Drop[l, -n]` count from the end. Fixed here by
// rewriting a negative count against the source's own (exact) length into the POSITIVE form of
// the OTHER operation -- `Take(xs, -n)` becomes "drop the first `length(xs) - n` elements",
// `Drop(xs, -n)` becomes "take the first `length(xs) - n`" -- and only when that length is
// known and finite; an unbounded or otherwise indeterminate source falls back to the native
// (clamped) handlers exactly as before, since there is no length to count back from. A
// magnitude past the source's length, of either sign (`Take([1, 2], -5)`, `Take([1, 2], 5)`;
// native clamps the positive one to the whole/empty list): Wolfram's `Take[l, n]`/`Drop[l, n]`
// raise `Take::take`/`Drop::drop` and leave the call unevaluated rather than
// answer with a clamped list, so this declines (`.count`/`.at` answer `undefined`, the
// iterator yields nothing, `.isEmpty` answers `undefined`) -- the same shape a `count`/`at`/
// `iterator` that were simply never patched for this case would leave behind.
// `operator.compile`'s JavaScript target has the identical clamp for a non-constant (runtime)
// count, which constant folding papers over for a literal count but not a `Function` parameter
// -- patched alongside so a compiled negative count also reads from the end, and a compiled
// overflow throws (a compiled function always returns a concrete value; it has no unevaluated
// form to fall back to, so a thrown `Error` is the closest analogue to Wolfram's message).

/** The source collection's element count, or `undefined` when it is not known and finite. */
function finiteSourceCount(xs: BoxedExpression): number | undefined {
  const count = xs.count;
  return count !== undefined && Number.isFinite(count) ? count : undefined;
}

/** The source collection (first operand) of a `Take`/`Drop` call. */
function sourceOf(expr: BoxedExpression): BoxedExpression | undefined {
  return operandsOf(expr)[0];
}

/** The literal integer count operand of a `Take`/`Drop` call, or `undefined` if it is not one
 * (symbolic, non-integer, ...) -- those cases are left to the native handlers untouched. */
function literalCount(expr: BoxedExpression): number | undefined {
  const count = operandsOf(expr)[1];
  return count !== undefined && Number.isInteger(count.re) ? count.re : undefined;
}

/** What a `Take`/`Drop` count denotes: `"native"` when the count isn't negative (and within the
 * source's length), or the source's length isn't known and finite, so the untouched native
 * handler already answers; `"overflow"` when the magnitude of either sign exceeds the
 * source's length -- no positions to take/drop, so this DECLINES, as
 * Wolfram's `Take::take`/`Drop::drop` do; otherwise the `[start, end)` 0-based, half-open span
 * of the source the call keeps. */
type NegativeCount = "native" | "overflow" | { readonly start: number; readonly end: number };

function negativeCountSpan(expr: BoxedExpression, keepsTail: boolean): NegativeCount {
  const count = literalCount(expr);
  if (count === undefined) return "native";
  const xs = sourceOf(expr);
  const length = xs === undefined ? undefined : finiteSourceCount(xs);
  if (length === undefined) return "native";
  const magnitude = Math.abs(count);
  if (magnitude > length) return "overflow";
  if (count >= 0) return "native";
  return keepsTail ? { start: length - magnitude, end: length } : { start: 0, end: length - magnitude };
}

type TakeDropCollectionHandlers = CollectionHandlers & { isEmpty?: (expr: BoxedExpression) => boolean | undefined };

/** Patch one of `Take`/`Drop`'s `count`, `iterator`, `at`, `isEmpty` collection handlers, and
 * its JavaScript `compile` codegen, to rewrite a negative count into the positive span above
 * (or decline, past the source's length), in place -- every other handler, and the native ones
 * for a non-negative or indeterminate count, are kept. `keepsTail` is `true` for `Take` (a
 * negative count keeps the END of the source), `false` for `Drop` (a negative count keeps the
 * START, dropping the end). */
function patchNegativeCount(ce: ComputeEngine, name: "Take" | "Drop", keepsTail: boolean): void {
  const definition = ce.lookupDefinition(name);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const collection = operator.collection as TakeDropCollectionHandlers | undefined;
  if (collection === undefined) return;
  const nativeIterator = collection.iterator;
  const nativeAt = collection.at;
  const nativeCount = collection.count;
  const nativeIsEmpty = collection.isEmpty;
  const nativeCompile = operator.compile;

  collection.count = (expr) => {
    const span = negativeCountSpan(expr, keepsTail);
    if (span === "native") return nativeCount(expr);
    if (span === "overflow") return undefined;
    return span.end - span.start;
  };

  if (nativeIsEmpty !== undefined) {
    collection.isEmpty = (expr) => {
      const span = negativeCountSpan(expr, keepsTail);
      if (span === "native") return nativeIsEmpty(expr);
      if (span === "overflow") return undefined;
      return span.end - span.start <= 0;
    };
  }

  collection.iterator = (expr) => {
    const span = negativeCountSpan(expr, keepsTail);
    if (span === "native") return nativeIterator(expr);
    if (span === "overflow") return { next: () => ({ value: undefined, done: true }) };
    const xs = sourceOf(expr)!;
    let index = span.start + 1; // `.at` is 1-based
    return {
      next: () => {
        if (index > span.end) return { value: undefined, done: true };
        const value = xs.at(index);
        index += 1;
        return value === undefined ? { value: undefined, done: true } : { value, done: false };
      },
    };
  };

  collection.at = (expr, index) => {
    if (typeof index !== "number" || !Number.isInteger(index)) return nativeAt?.(expr, index as never);
    const span = negativeCountSpan(expr, keepsTail);
    if (span === "native") return nativeAt?.(expr, index);
    if (span === "overflow") return undefined;
    const xs = sourceOf(expr)!;
    const length = span.end - span.start;
    const k = index > 0 ? index : length + index + 1; // negative index counts from the end
    return k < 1 || k > length ? undefined : xs.at(span.start + k);
  };

  operator.compile = ((args, compile, ctx) => {
    if ((ctx as { language?: string } | undefined)?.language !== "javascript") {
      return nativeCompile?.(args, compile, ctx as never);
    }
    const xs = args[0];
    const count = args[1];
    if (xs === undefined || count === undefined) return nativeCompile?.(args, compile, ctx as never);
    const xsCode = compile(xs);
    const countCode = compile(count);
    const message = JSON.stringify(`${name}: count exceeds the source's length`);
    const takeSlice = keepsTail
      ? `n >= 0 ? (n > xs.length ? over() : xs.slice(0, n)) : (-n > xs.length ? over() : xs.slice(xs.length + n))`
      : `n >= 0 ? (n > xs.length ? over() : xs.slice(n)) : (-n > xs.length ? over() : xs.slice(0, xs.length + n))`;
    return `((xs, n) => { const over = () => { throw new Error(${message}); }; n = Math.round(n); return ${takeSlice}; })(${xsCode}, ${countCode})`;
  }) as typeof operator.compile;
}

/** Patch `Take` and `Drop`'s collection handlers and JavaScript compilation so a negative
 * count reads from the end of the source, and a count past the length declines, as Wolfram's
 * `Take`/`Drop` do. */
export function evaluateTakeDropNegativeCount(ce: ComputeEngine): void {
  patchNegativeCount(ce, "Take", true);
  patchNegativeCount(ce, "Drop", false);
}
