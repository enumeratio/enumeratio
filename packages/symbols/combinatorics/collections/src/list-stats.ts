import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { isMatrixLike } from "./list-heads.ts";

// The remaining #113 list/statistics gaps: Mean/Median on data compute-engine's own
// numeric-only reducers can't average exactly (plain symbols, exact constants like Pi),
// Commonest's count argument, Sort/Take/Fold/Tabulate/Unique's small arity gaps. Each
// override only fires on the specific shape compute-engine leaves unevaluated; everything
// else falls through to the native handler untouched.

/** True for an actual number literal (Integer/Rational/Real/Complex) — what compute-engine's
 *  own Mean/Median reduce numerically. A plain symbol or an exact constant like `Pi` is
 *  `isNumber` but NOT a literal: reducing those calls for `.re` and gets a float approximation
 *  (or `NaN`), not the exact symbolic answer Wolfram gives. */
const isNumberLiteral = (x: BoxedExpression): boolean =>
  (x as unknown as { isNumberLiteral?: boolean }).isNumberLiteral === true;

/** Ascending numeric order via `isLess`; `undefined` if the pair's order isn't decidable
 *  (e.g. two unrelated symbols) — callers only use this once every element is known
 *  comparable (`isNumber === true`). */
const compareByValue = (a: BoxedExpression, b: BoxedExpression): number => {
  if (a.isLess(b) === true) return -1;
  if (a.isGreater(b) === true) return 1;
  return 0;
};

/** $\frac{1}{n}\sum xs$, built and evaluated symbolically rather than reduced to a float —
 *  what carries a plain symbol or an exact constant like `Pi` through exactly. */
const symbolicMean = (ce: ComputeEngine, xs: readonly BoxedExpression[]): BoxedExpression =>
  ce
    .function("Multiply", [ce.function("Rational", [1, xs.length]), ce.function("Add", [...xs])])
    .evaluate();

/** Declare the Mean/Median/Commonest/Sort/Take/Fold/Tabulate/Unique overrides. */
export function declareListStats(ce: ComputeEngine): void {
  // Mean(xs) / Median(xs): compute-engine's own reducers call `.re` on every element, which
  // gives a numeric approximation for a symbolic constant like Pi (not its exact value) and
  // NaN for a plain symbol. Only a flat list with at least one non-literal element is in
  // scope — a matrix falls through here (`isMatrixLike`, checked so this layer doesn't
  // misread a matrix's rows as "non-numeric elements") to the column-wise arm declared in
  // `list-heads.ts`, which re-enters Mean/Median per column and lands back on this same
  // wrap for a symbolic column.
  wrapOperator(
    ce,
    ["Mean", 1],
    (ops) =>
      ops.length === 1 &&
      ops[0].operator === "List" &&
      !isMatrixLike(ops[0]) &&
      operandsOf(ops[0]).length > 0 &&
      !operandsOf(ops[0]).every(isNumberLiteral),
    () => (ops) => symbolicMean(ce, operandsOf(ops[0])),
  );

  // Median(xs): the same numeric-literal gap, but only where every element is actually
  // orderable (`isNumber === true`) — a plain symbol has no defined position to sort into,
  // so that case is left alone (unevaluated, same as today) rather than guessed at.
  wrapOperator(
    ce,
    ["Median", 1],
    (ops) =>
      ops.length === 1 &&
      ops[0].operator === "List" &&
      !isMatrixLike(ops[0]) &&
      operandsOf(ops[0]).length > 0 &&
      !operandsOf(ops[0]).every(isNumberLiteral) &&
      operandsOf(ops[0]).every((x) => x.isNumber === true),
    () => (ops) => {
      const sorted = [...operandsOf(ops[0])].sort(compareByValue);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1
        ? sorted[mid]
        : symbolicMean(ce, [sorted[mid - 1], sorted[mid]]);
    },
  );

  // Commonest(c, n): the n commonest elements, most frequent first, ties broken by first
  // appearance (a stable sort over the tally, which is itself built in first-appearance
  // order). Commonest(c) (1-arg, every tied value) is declared in `list-heads.ts`; this only
  // adds the count argument.
  widenSignature(ce, "Commonest", "(indexed_collection<any>, integer?) -> list<any>");
  wrapOperator(
    ce,
    ["Commonest", 1, 1],
    (ops) => ops.length === 2 && integerAt(ops[1]) !== undefined,
    () => (ops) => {
      const items = operandsOf(ops[0]);
      const n = integerAt(ops[1])!;
      const tally: { value: BoxedExpression; count: number }[] = [];
      for (const item of items) {
        const existing = tally.find((entry) => entry.value.isEqual(item) === true);
        if (existing !== undefined) existing.count++;
        else tally.push({ value: item, count: 1 });
      }
      const ranked = [...tally].sort((a, b) => b.count - a.count);
      return ce.box(["List", ...ranked.slice(0, n).map((entry) => entry.value)]);
    },
  );

  // Mode(c) over data that is not all numbers: the commonest value, ties to the first to
  // appear -- Commonest(c)'s first. Native Mode takes numbers only (ties to the smallest).
  wrapOperator(
    ce,
    ["Mode", 1],
    (ops) => ops[0]?.operator === "List" && !operandsOf(ops[0]).every(isNumberLiteral),
    () => (ops) => {
      const commonest = ce.function("Commonest", [ops[0]!]).evaluate();
      return commonest.operator === "List" ? operandsOf(commonest)[0] : undefined;
    },
    1,
  );

  // Sort({}): the empty list sorts to itself — compute-engine leaves it unevaluated instead
  // of answering trivially.
  wrapOperator(
    ce,
    ["Sort", 1],
    (ops) => ops.length === 1 && ops[0].operator === "List" && operandsOf(ops[0]).length === 0,
    () => (ops) => ops[0],
  );

  // Take(xs, UpTo(n)): compute-engine's Take has neither a `canonical` nor an `evaluate` of
  // its own — it's answered entirely through the operator's `collection` protocol (`.at`,
  // `.count`, `.iterator`, …), the same one the numeric-set domains rely on. Assigning
  // `operator.evaluate` (or even a pass-through `operator.canonical`) replaces that protocol
  // dispatch outright and leaves EVERY call, not just the UpTo one, unevaluated — confirmed
  // empirically, not just documented in #135. The safe seam is the protocol functions
  // themselves: each is wrapped to rewrite `Take(xs, UpTo(n))` into `Take(xs, Min(n,
  // Length(xs)))` before calling through, and left untouched for every other call shape
  // (including a plain integer count, and Partition's own separate UpTo reading).
  {
    const definition = ce.lookupDefinition("Take");
    const operator =
      definition !== undefined && "operator" in definition
        ? (definition as { operator: { collection?: Record<string, unknown> } }).operator
        : undefined;
    const collection = operator?.collection;
    if (operator !== undefined && collection !== undefined) {
      const rewriteUpTo = (expr: BoxedExpression): BoxedExpression => {
        const ops = operandsOf(expr);
        if (ops.length !== 2 || ops[1].operator !== "UpTo") return expr;
        const n = operandsOf(ops[1])[0];
        if (n === undefined) return expr;
        const count = ce.function("Min", [n, ce.function("Length", [ops[0]])]);
        return ce.function("Take", [ops[0], count]);
      };
      const wrapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(collection)) {
        wrapped[key] =
          typeof value === "function"
            ? (expr: BoxedExpression, ...rest: unknown[]) =>
                (value as (...args: unknown[]) => unknown)(rewriteUpTo(expr), ...rest)
            : value;
      }
      // A source of unknown size (`Count(TwinPrimes) = NaN`) leaves compute-engine's count at
      // Min(n, NaN) = NaN, and materializing a collection of unknown count stops after five
      // elements. The first n exist exactly when the n-th does.
      const count = wrapped.count as ((expr: BoxedExpression) => number | undefined) | undefined;
      wrapped.count = (expr: BoxedExpression) => {
        const total = count?.(expr);
        if (total === undefined || !Number.isNaN(total)) return total;
        const [source, spec] = operandsOf(rewriteUpTo(expr));
        const n = spec?.re;
        if (source === undefined || n === undefined || !Number.isInteger(n) || n < 0) return total;
        return n === 0 || source.evaluate().at(n) !== undefined ? n : total;
      };
      operator.collection = wrapped;
    }
  }

  // Fold(f, xs): the unseeded 2-argument form, starting from the first element rather than
  // an explicit seed — Wolfram's Fold[f, list]. Compute-engine's own Fold requires all three
  // arguments (f, init, xs); its `canonical` returns null for 2 operands rather than reading
  // the first as the collection, so this rewrites to the 3-argument form (seed = First(xs),
  // rest = Rest(xs)) at `canonical`, the same seam the Join/Append overrides above use, before
  // handing off to the native canonical for the actual fold.
  {
    const definition = ce.lookupDefinition("Fold");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (
                  ops: readonly BoxedExpression[],
                  options: unknown,
                ) => BoxedExpression | undefined | null;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      const nativeOperator = Object.create(operator) as typeof operator;
      nativeOperator.canonical = nativeCanonical;
      operator.canonical = (ops, options) => {
        if (ops.length === 2) {
          const collection = ops[1];
          const first = ce.function("First", [collection]);
          const rest = ce.function("Rest", [collection]);
          return nativeCanonical?.call(nativeOperator, [ops[0], first, rest], options);
        }
        return nativeCanonical?.call(nativeOperator, ops, options);
      };
    }
  }

  // Tabulate(f, n): like Take above, Tabulate is answered through its `collection` protocol
  // rather than a native `evaluate` (confirmed the same way — a pass-through `evaluate`
  // regresses even the working 1D/2D cases to unevaluated). Its `canonical`, though, DOES
  // exist natively and simply drops any dimension past the second — so the fix lives there
  // instead: three or more dimensions, or a literal 0 in any dimension (the generator can't
  // represent an empty axis), are materialized directly by calling `f` at every 1-based index
  // tuple ourselves; one or two positive dimensions still take the native, lazy path
  // unchanged.
  {
    const definition = ce.lookupDefinition("Tabulate");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (
                  ops: readonly BoxedExpression[],
                  options: unknown,
                ) => BoxedExpression | undefined | null;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      const nativeOperator = Object.create(operator) as typeof operator;
      nativeOperator.canonical = nativeCanonical;
      const applyAt = (fn: BoxedExpression, indices: readonly number[]): BoxedExpression =>
        ce.function("Apply", [fn, ...indices.map((i) => ce.number(i))]).evaluate();
      const materialize = (
        fn: BoxedExpression,
        dims: readonly number[],
        prefix: readonly number[] = [],
      ): BoxedExpression => {
        if (dims.length === 0) return applyAt(fn, prefix);
        const [d, ...rest] = dims;
        return ce.box([
          "List",
          ...Array.from({ length: d }, (_, i) => materialize(fn, rest, [...prefix, i + 1])),
        ]);
      };
      operator.canonical = (ops, options) => {
        const fn = ops[0];
        const dims = ops.slice(1).map(integerAt);
        const needsOverride = dims.length > 2 || dims.some((d) => d === 0);
        if (needsOverride && fn !== undefined && dims.every((d) => d !== undefined)) {
          return materialize(fn, dims as number[]);
        }
        return nativeCanonical?.call(nativeOperator, ops, options);
      };
    }
  }

  // Unique(xs, test): a second argument saying when two elements count as duplicates —
  // Wolfram's `test` form. An element is dropped once it matches (via `test`) something
  // already kept, so `test` never has to be a total-order comparator, just a pairwise
  // sameness check. The 1-argument form (structural equality) is compute-engine's own,
  // untouched.
  widenSignature(ce, "Unique", "(collection<any>, function?) -> list<any>");
  wrapOperator(
    ce,
    ["Unique", 1, 1],
    (ops) => ops.length === 2,
    (native) => (ops, options) => {
      const test = ops[1];
      if (test.operator !== "Function" && symbolNameOf(test) === undefined) {
        return native?.(ops, options);
      }
      const items = operandsOf(ops[0]);
      const kept: BoxedExpression[] = [];
      for (const item of items) {
        const isDuplicate = kept.some(
          (k) => symbolNameOf(ce.function("Apply", [test, k, item]).evaluate()) === "True",
        );
        if (!isDuplicate) kept.push(item);
      }
      return ce.box(["List", ...kept]);
    },
  );
}
