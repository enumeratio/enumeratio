import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;
type CollectionHandlers = NonNullable<OperatorDefinition["collection"]>;

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
