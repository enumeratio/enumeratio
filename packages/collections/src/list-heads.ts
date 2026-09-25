import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  integerAt,
  operandsOf,
  stringAt,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";

// The core list/statistics heads compute-engine ships but doesn't fully answer yet —
// widened arities (First/Last's empty-collection default, Ordering's take-n, Clamp's
// 1-arg default range), matrix-aware Mean/Median, and a handful of Wolfram-matching
// overrides (Sort on strings, Union's sort, At(c, 0), Partition's ragged tail, Join's
// level argument). Plus two new heads, Commonest and Position, for cases where
// Wolfram's answer is a LIST where ours (Mode, IndexOf) stays a scalar.
//
// Each override only fires on the specific case compute-engine gets wrong or leaves
// unanswered; everything else falls through to the native handler untouched.

/** Ascending order: numeric/orderable via `isLess`/`isGreater`, lexicographic for strings,
 *  alphabetical by name for symbols (Wolfram's canonical order — compute-engine's own
 *  `isLess`/`isGreater` don't compare two symbols, so without this they tie and the
 *  ordering falls back to input position). */
const naturalCompare = (a: BoxedExpression, b: BoxedExpression): number => {
  const as = stringAt(a);
  const bs = stringAt(b);
  if (as !== undefined && bs !== undefined) return as < bs ? -1 : as > bs ? 1 : 0;
  const asym = symbolNameOf(a);
  const bsym = symbolNameOf(b);
  if (asym !== undefined && bsym !== undefined) return asym < bsym ? -1 : asym > bsym ? 1 : 0;
  if (a.isLess(b) === true) return -1;
  if (a.isGreater(b) === true) return 1;
  return 0;
};

/** The full permutation of 1-based indices that sorts `items` ascending by `naturalCompare`,
 *  ties broken in favor of earlier position (a stable sort). */
const fullOrdering = (items: readonly BoxedExpression[]): number[] => {
  const indices = items.map((_, i) => i);
  indices.sort((i, j) => naturalCompare(items[i], items[j]) || i - j);
  return indices.map((i) => i + 1);
};

/** A 1-based, possibly-negative (counts from the end, like `Part`) index resolved against
 *  `length`, or `undefined` if it's 0 or out of range. */
const resolveIndex1Based = (index: number, length: number): number | undefined => {
  if (index > 0) return index <= length ? index - 1 : undefined;
  if (index < 0) return -index <= length ? length + index : undefined;
  return undefined;
};

/** What `Ordering`'s second argument asks for, once it isn't a plain comparator. */
type OrderingSpec =
  | { readonly kind: "count"; readonly n: number }
  | { readonly kind: "range"; readonly start: number; readonly end: number }
  | { readonly kind: "upTo"; readonly n: number };

const orderingSpecOf = (spec: BoxedExpression): OrderingSpec | undefined => {
  const n = integerAt(spec);
  if (n !== undefined) return { kind: "count", n };
  if (spec.operator === "UpTo") {
    const upTo = integerAt(operandsOf(spec)[0]);
    return upTo === undefined ? undefined : { kind: "upTo", n: upTo };
  }
  if (spec.operator === "List" && operandsOf(spec).length === 2) {
    const [start, end] = operandsOf(spec).map(integerAt);
    return start === undefined || end === undefined ? undefined : { kind: "range", start, end };
  }
  return undefined;
};

/** Apply an `OrderingSpec` to the full ordering. A positive count takes the first `n`
 *  indices (smallest elements); a negative count takes the last `|n|` (largest elements,
 *  still smallest-to-largest); a `{m, n}` range takes positions `m` through `n` of the
 *  full ordering (1-based, negative counts from the end); `UpTo(n)` caps at `n` without
 *  erroring on a shorter list. */
const applyOrderingSpec = (full: readonly number[], spec: OrderingSpec): number[] => {
  switch (spec.kind) {
    case "count":
      return spec.n >= 0 ? full.slice(0, spec.n) : full.slice(spec.n);
    case "upTo":
      return full.slice(0, Math.min(spec.n, full.length));
    case "range": {
      const start = resolveIndex1Based(spec.start, full.length);
      const end = resolveIndex1Based(spec.end, full.length);
      if (start === undefined || end === undefined || end < start) return [];
      return full.slice(start, end + 1);
    }
  }
};

/** A non-empty $List$ of $List$s, all the same shape — what Mean/Median thread over column-wise. */
export const isMatrixLike = (expr: BoxedExpression): boolean => {
  const rows = operandsOf(expr);
  if (rows.length === 0) return false;
  return rows.every((row) => row.operator === "List") && operandsOf(rows[0]).length > 0;
};

/** The columns of a row-major matrix (a $List$ of equal-length $List$ rows). */
const columnsOf = (rows: readonly BoxedExpression[]): BoxedExpression[][] => {
  const width = operandsOf(rows[0]).length;
  const columns: BoxedExpression[][] = Array.from({ length: width }, () => []);
  for (const row of rows) {
    operandsOf(row).forEach((cell, i) => columns[i]?.push(cell));
  }
  return columns;
};

/**
 * Reduce a matrix column-wise by calling `head` (Mean/Median) on each column — re-entered
 * through `ce.function(...).evaluate()` rather than a captured native handler, so a LATER
 * wrap on `head` (e.g. `list-stats.ts`'s symbolic Mean/Median) is picked up too. A column is
 * never itself matrix-shaped, so this can't recurse back into the matrix arm.
 */
const threadOverColumns =
  (ce: ComputeEngine, head: string) =>
  (matrix: BoxedExpression): BoxedExpression | undefined => {
    const columns = columnsOf(operandsOf(matrix));
    const results = columns.map((column) =>
      ce.function(head, [ce.box(["List", ...column])]).evaluate(),
    );
    return results.some((r) => r === undefined)
      ? undefined
      : ce.box(["List", ...(results as BoxedExpression[])]);
  };

/** Wolfram's `ArrayDepth`: how many levels of `expr` are a uniform (rectangular) array —
 *  every list at that level the same length as its siblings. Stops, rather than erroring,
 *  the moment a level is ragged or mixes lists with non-lists: that level is still a
 *  vector (depth 1) of whatever is there. A lazy `Tabulate(f, m, n, …)` reads as depth =
 *  the count of its dimension arguments, without generating a single element. */
const arrayRank = (expr: BoxedExpression): number => {
  if (expr.operator === "Tabulate") {
    return operandsOf(expr)
      .slice(1)
      .filter((op) => integerAt(op) !== undefined).length;
  }
  if (expr.operator !== "List") return 0;
  const items = operandsOf(expr);
  if (items.length === 0) return 1;
  if (items.every((item) => item.operator === "List")) {
    const length = operandsOf(items[0]).length;
    if (items.every((item) => operandsOf(item).length === length)) {
      return 1 + arrayRank(items[0]);
    }
  }
  return 1;
};

/** `fn(i, j)` via compute-engine's `Apply` — see `list-functional.ts`'s `applyFn` doc for
 *  why the arguments go in directly rather than wrapped in a `List`. */
const apply2 = (ce: ComputeEngine, fn: BoxedExpression, i: number, j: number): BoxedExpression =>
  ce.function("Apply", [fn, ce.number(i), ce.number(j)]).evaluate();

/** A lazy `Tabulate(f, m, n)` read into an actual `m`×`n` matrix by calling `f(i, j)` at
 *  every 1-based position — `undefined` for any other `Tabulate` arity, or a non-integer
 *  dimension. */
const materializeTabulate = (
  ce: ComputeEngine,
  expr: BoxedExpression,
): BoxedExpression | undefined => {
  const [fn, mOp, nOp] = operandsOf(expr);
  const m = integerAt(mOp);
  const n = integerAt(nOp);
  if (fn === undefined || m === undefined || n === undefined) return undefined;
  const rows: BoxedExpression[] = [];
  for (let i = 1; i <= m; i++) {
    const row: BoxedExpression[] = [];
    for (let j = 1; j <= n; j++) row.push(apply2(ce, fn, i, j));
    rows.push(ce.box(["List", ...row]));
  }
  return ce.box(["List", ...rows]);
};

/** `Join` at a level `n > 1`: recursively join corresponding sublists n-1 levels down. */
const joinAtLevel = (
  ce: ComputeEngine,
  lists: readonly BoxedExpression[],
  level: number,
): BoxedExpression => {
  if (level <= 1) return ce.box(["List", ...lists.flatMap((list) => operandsOf(list))]);
  const rows = lists.map((list) => operandsOf(list));
  const length = rows[0]?.length ?? 0;
  const merged: BoxedExpression[] = [];
  for (let i = 0; i < length; i++) {
    const slice = rows
      .map((row) => row[i])
      .filter((cell): cell is BoxedExpression => cell !== undefined);
    merged.push(joinAtLevel(ce, slice, level - 1));
  }
  return ce.box(["List", ...merged]);
};

/** Declare the core list/statistics widenings, overrides and new heads. */
export function declareListHeads(ce: ComputeEngine): void {
  // First(c, default) / Last(c, default): a fallback for an empty collection, which
  // compute-engine doesn't accept a second argument for yet.
  widenSignature(ce, "First", "(any, any?) -> any");
  wrapOperator(
    ce,
    ["First", 1, 1],
    () => true,
    (native) => (ops, options) =>
      operandsOf(ops[0]).length === 0 ? ops[1] : native?.([ops[0]], options),
    2,
  );
  widenSignature(ce, "Last", "(any, any?) -> any");
  wrapOperator(
    ce,
    ["Last", 1, 1],
    () => true,
    (native) => (ops, options) =>
      operandsOf(ops[0]).length === 0 ? ops[1] : native?.([ops[0]], options),
    2,
  );

  // First(f(a, b, …)) / Last(f(a, b, …)): any head's operands, not just a collection's —
  // Wolfram's First/Last work on the arguments of any expression. Tried after everything
  // above (empty-collection default, native indexed-collection handling); only the
  // `Error` native gives a non-collection first argument falls through to this.
  wrapOperator(
    ce,
    ["First", 1, 2],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      if (result !== undefined && result.operator !== "Error") return result;
      const operands = operandsOf(ops[0]);
      if (operands.length > 0) return operands[0];
      return ops.length === 2 ? ops[1] : result;
    },
    { min: 1, max: 2 },
  );
  wrapOperator(
    ce,
    ["Last", 1, 2],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      if (result !== undefined && result.operator !== "Error") return result;
      const operands = operandsOf(ops[0]);
      if (operands.length > 0) return operands[operands.length - 1];
      return ops.length === 2 ? ops[1] : result;
    },
    { min: 1, max: 2 },
  );

  // Ordering(c): the full permutation, computed ourselves rather than delegated to
  // compute-engine's native handler — which only compares numbers, leaving a list of
  // symbols in identity order (`naturalCompare`, above, adds symbols and strings).
  //
  // Ordering(c, n | {m, n} | UpTo(n)): a slice of the full ordering — see `OrderingSpec`.
  // Ordering(c, All, Greater): every index, sorted descending rather than ascending; the
  // one custom-test form in scope (`All` positions, `Greater` as the comparator) — any
  // other test symbol falls through unevaluated rather than guessing at its meaning.
  widenSignature(ce, "Ordering", "(indexed_collection<any>, any?, any?) -> list<integer>");
  wrapOperator(
    ce,
    ["Ordering", 1, 1],
    (ops) =>
      ops.length === 1 ||
      (ops.length === 2 && orderingSpecOf(ops[1]) !== undefined) ||
      (ops.length === 3 && symbolNameOf(ops[1]) === "All" && symbolNameOf(ops[2]) === "Greater"),
    () => (ops) => {
      const items = operandsOf(ops[0]);
      const full = fullOrdering(items);
      if (ops.length === 3) return ce.box(["List", ...[...full].reverse()]);
      if (ops.length === 1) return ce.box(["List", ...full]);
      return ce.box(["List", ...applyOrderingSpec(full, orderingSpecOf(ops[1])!)]);
    },
    { min: 1, max: 3 },
  );

  // Mean/Median thread column-wise over a matrix (a list of equal-length rows), reusing
  // the native 1-arg logic on each column rather than reimplementing the arithmetic.
  for (const head of ["Mean", "Median"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isMatrixLike(ops[0]),
      () => (ops) => threadOverColumns(ce, head)(ops[0]),
      1,
    );
  }

  // Clamp(x): defaults to Wolfram's Clip[x] range, [-1, 1]. All three arguments were
  // required before.
  widenSignature(
    ce,
    "Clamp",
    "(real | signed_infinity, (real | signed_infinity)?, (real | signed_infinity)?) -> real | signed_infinity",
  );
  wrapOperator(
    ce,
    ["Clamp", 1],
    () => true,
    (native) => (ops, options) => native?.([ops[0], ce.number(-1), ce.number(1)], options),
    1,
  );

  // Sort(strings): compute-engine's Sort only orders numbers, leaving a list of strings
  // untouched — a bug, not a deliberate scope limit. Numeric and comparator-form Sort are
  // untouched; only a plain, non-empty list of strings is affected.
  wrapOperator(
    ce,
    ["Sort", 1],
    (ops) =>
      ops[0].operator === "List" &&
      operandsOf(ops[0]).length > 0 &&
      operandsOf(ops[0]).every((element) => stringAt(element) !== undefined),
    () => (ops) => ce.box(["List", ...[...operandsOf(ops[0])].sort(naturalCompare)]),
    1,
  );

  // Sort(f(a, b, …)): any head's operands sorted in place, not just a `List`'s — tried
  // after the string-list case above; only a native `Error` (a non-collection head) falls
  // through to this.
  wrapOperator(
    ce,
    ["Sort", 1],
    (ops) => ops[0].operator !== "List",
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      if (result !== undefined && result.operator !== "Error") return result;
      return ce.function(ops[0].operator, [...operandsOf(ops[0])].sort(naturalCompare));
    },
    1,
  );

  // Union(...): Wolfram's Union sorts; compute-engine keeps first-seen order. Variadic —
  // any non-empty call is in scope, so the guard is a floor, not an exact count.
  wrapOperator(
    ce,
    ["Union", 1],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      return result === undefined || result.operator !== "Set"
        ? result
        : ce.box(["Set", ...[...operandsOf(result)].sort(naturalCompare)]);
    },
    { min: 1 },
  );

  // Length(x): an atom has no parts, so its length is 0; any other head's length is its
  // operand count — Wolfram's Length works on the arguments of any expression, not just a
  // collection's. compute-engine raises a type error for both instead. Length is unary;
  // guard explicitly so a future widening of the signature can't reach this rule with
  // extra operands.
  wrapOperator(
    ce,
    ["Length", 1],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      return result === undefined || result.operator === "Error"
        ? ce.number(operandsOf(ops[0]).length)
        : result;
    },
    1,
  );

  // At(c, 0): Wolfram's Part[c, 0] gives the head of c; compute-engine gives NaN.
  wrapOperator(
    ce,
    ["At", 1, 1],
    (ops) => integerAt(ops[1]) === 0,
    () => (ops) => ce.symbol(ops[0].operator),
    2,
  );

  // At(c, Span(start, end, step?)): a Wolfram `start;;end;;step` slice — compute-engine has
  // no `Span`. Resolved to an explicit 1-based index list (negative bounds count from the
  // end, like `Part`) and handed to the native list-of-indices form, so a single- or
  // multi-level call behaves exactly as it would for a literal index list.
  wrapOperator(
    ce,
    ["At", 1, 1],
    (ops) => ops[1].operator === "Span",
    (native) => (ops, options) => {
      const length = operandsOf(ops[0]).length;
      const spanOps = operandsOf(ops[1]);
      const start = integerAt(spanOps[0]) ?? 1;
      const end = integerAt(spanOps[1]) ?? -1;
      const step = integerAt(spanOps[2]) ?? 1;
      if (step === 0) return undefined;
      const bound = (v: number): number => (v > 0 ? v : length + v + 1);
      const from = bound(start);
      const to = bound(end);
      const indices: number[] = [];
      if (step > 0) for (let i = from; i <= to; i += step) indices.push(i);
      else for (let i = from; i >= to; i += step) indices.push(i);
      return native?.([ops[0], ce.box(["List", ...indices])], options);
    },
    2,
  );

  // At(c, All, colSpec): every row's colSpec-selected part, Wolfram's whole-column read.
  // At(c, rowSpec, colSpec) where both are index lists: the submatrix at those rows and
  // columns. Both delegate each row's extraction back to the native (or already-wrapped)
  // 2-arg form, rather than reimplementing index resolution.
  wrapOperator(
    ce,
    ["At", 1, 2],
    (ops) =>
      (symbolNameOf(ops[1]) === "All" && ops[0].operator === "List") ||
      (ops[1].operator === "List" && ops[2].operator === "List"),
    (native) => (ops, options) => {
      const rows =
        symbolNameOf(ops[1]) === "All"
          ? operandsOf(ops[0])
          : operandsOf(native?.([ops[0], ops[1]], options) ?? ce.box(["List"]));
      const results = rows.map((row) => native?.([row, ops[2]], options));
      return results.some((r) => r === undefined)
        ? undefined
        : ce.box(["List", ...(results as BoxedExpression[])]);
    },
    3,
  );

  // Partition(c, n): drop the ragged remainder when the length isn't a multiple of n,
  // matching Wolfram. The overlapping-window form, Partition(c, n, d), is untouched.
  wrapOperator(
    ce,
    ["Partition", 1, 1],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      if (result === undefined || result.operator !== "List") return result;
      const chunks = operandsOf(result);
      const n = integerAt(ops[1]);
      if (n === undefined || chunks.length === 0) return result;
      const lastLength = operandsOf(chunks[chunks.length - 1]).length;
      return lastLength === n ? result : ce.box(["List", ...chunks.slice(0, -1)]);
    },
    2,
  );

  // Join(a, b, …, n): a trailing integer is a level, not an element to append —
  // corresponding sublists n-1 levels down are joined pairwise.
  //
  // Join is a variadic collection operator, so compute-engine folds a call over literal
  // LIST arguments at BOX time, through `operator.canonical`, before `evaluate` ever runs —
  // wrapping `evaluate` alone (as every other override here does) never reaches that shape.
  // Both hooks are wrapped so the override fires whichever path reduces a given call.
  //
  // Regression note: adding `operator.evaluate` below (Join had none natively — canonical
  // did the whole job) changes what the native canonical fold does with operands it can't
  // type-merge itself: a homogeneous `List` still merges entirely within canonical (a fast
  // path unaffected by whether `evaluate` exists), but `Set` operands and the 0-ary call
  // now come back as an unevaluated `Join(...)` call for `evaluate` to finish — which
  // nothing did, once evaluate existed and didn't handle them, regressing
  // `Join(Set(1, 2), Set(3))` and `Join()` to unevaluated. Both are handled in the
  // `evaluate` wrapper below, alongside join-at-level, rather than in canonical.
  const joinsAtLevel = (
    ops: readonly BoxedExpression[],
  ): { readonly lists: readonly BoxedExpression[]; readonly level: number } | undefined => {
    if (ops.length < 3) return undefined;
    const level = integerAt(ops[ops.length - 1]);
    const lists = ops.slice(0, -1);
    return level !== undefined && level >= 1 && lists.every((op) => op.operator === "List")
      ? { lists, level }
      : undefined;
  };
  wrapOperator(
    ce,
    ["Join", 1, 1],
    (ops) =>
      joinsAtLevel(ops) !== undefined ||
      ops.length === 0 ||
      (ops.length >= 1 && ops.every((op) => op.operator === "Set")),
    () => (ops) => {
      const join = joinsAtLevel(ops);
      if (join !== undefined) return joinAtLevel(ce, join.lists, join.level);
      if (ops.length === 0) return ce.box(["List"]);
      return ce.box(["Set", ...ops.flatMap((op) => operandsOf(op))]);
    },
  );
  {
    const definition = ce.lookupDefinition("Join");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (
                  ops: readonly BoxedExpression[],
                  options: unknown,
                ) => BoxedExpression | undefined;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      // The native fold, for operands it can't merge itself, recurses through `this.canonical`
      // rather than calling itself directly — and `this` is `operator`, whose `.canonical` is
      // what we're about to overwrite. Calling `nativeCanonical` bound to the real operator
      // would recurse into OUR wrapper forever; a stand-in whose own `.canonical` is pinned to
      // `nativeCanonical` breaks the cycle, so the native fold's self-calls land back on the
      // native fold, exactly as they would have before this override existed.
      const nativeOperator = Object.create(operator) as typeof operator;
      nativeOperator.canonical = nativeCanonical;
      operator.canonical = (ops, options) => {
        const join = joinsAtLevel(ops);
        return join !== undefined
          ? joinAtLevel(ce, join.lists, join.level)
          : nativeCanonical?.call(nativeOperator, ops, options);
      };
    }
  }

  // Commonest(c): every element tied for the highest frequency, Wolfram's answer to a
  // tied Mode — which stays a single value. See [[Mode]].
  ce.declare("Commonest", {
    signature: "(indexed_collection<any>) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      const tally: { value: BoxedExpression; count: number }[] = [];
      for (const item of items) {
        const existing = tally.find((entry) => entry.value.isEqual(item) === true);
        if (existing !== undefined) existing.count++;
        else tally.push({ value: item, count: 1 });
      }
      const highest = tally.reduce((max, entry) => Math.max(max, entry.count), 0);
      return ce.box([
        "List",
        ...tally.filter((entry) => entry.count === highest).map((entry) => entry.value),
      ]);
    },
  });

  // Position(c, value): every position `value` occurs at, each wrapped as its own list —
  // Wolfram's answer where [[IndexOf]] reports only the first. compute-engine already has
  // a Position, but with different arguments and shape: `Position(c, predicate)` takes a
  // (T) -> boolean function and answers a flat `list<integer>`. That call form — a second
  // operand that IS a function — is untouched; only a plain VALUE in the second slot (not
  // a function) gets Wolfram's value-matching, each-wrapped-in-its-own-list answer.
  widenSignature(ce, "Position", "(indexed_collection<any>, any) -> list<any>");
  wrapOperator(
    ce,
    ["Position", 1, 1],
    (ops) => ops[1].operator !== "Function",
    () => (ops) => {
      const items = operandsOf(ops[0]);
      const value = ops[1];
      const positions = items
        .map((item, i) => (item.isEqual(value) === true ? ce.box(["List", i + 1]) : undefined))
        .filter((position): position is BoxedExpression => position !== undefined);
      return ce.box(["List", ...positions]);
    },
    2,
  );

  // Rank(x): compute-engine's own answer is 0 for a ragged or mixed list, an empty list,
  // or a lazy Tabulate — all of which are still arrays, just not (fully, or not yet)
  // materialized ones. `arrayRank` replaces the native answer outright rather than only
  // patching the cases it misses: it agrees with the native handler everywhere it was
  // already right (see its own doc), so there's nothing to fall back to.
  wrapOperator(
    ce,
    ["Rank", 1],
    () => true,
    () => (ops) => ce.number(arrayRank(ops[0])),
    1,
  );

  // MatrixRank(Tabulate(f, m, n)): a lazy Tabulate is read as the m×n matrix it describes
  // before handing off to the native rank computation, rather than left unevaluated.
  wrapOperator(
    ce,
    ["MatrixRank", 1],
    (ops) => ops[0].operator === "Tabulate",
    (native) => (ops, options) => {
      const matrix = materializeTabulate(ce, ops[0]);
      return matrix === undefined ? undefined : native?.([matrix], options);
    },
    1,
  );

  // Append(f(a, b, …), value): any head's operands, not just a collection's — Wolfram's
  // Append works on the arguments of any expression.
  //
  // Patched on `operator.canonical`, not via `wrapOperator` on `evaluate`: Append, like
  // Join (see that override's own note), has no native `evaluate` — canonical does the
  // whole job, including materializing a lazy `Range`. Adding an `evaluate` at all (even
  // a pass-through) changes what canonical does with operands it can't itself merge,
  // regressing `Append(Range(1, 3), 4)` the same way it regressed `Join`.
  //
  // Dispatched by the FIRST operand's head, not by probing whether the native fold
  // "worked": the native fold's own result for a head it recognizes isn't reliably
  // distinguishable from one it doesn't by inspecting `.operator` alone (a materialized
  // `Range` still reads as an unresolved `Append` call at this point, resolving only on
  // a later, separate pass) — so heads compute-engine's own Append already knows about
  // are named here explicitly, and everything else gets the any-head answer directly.
  const NATIVE_APPEND_HEADS = new Set(["List", "Set", "Range", "Dictionary", "Tuple"]);
  {
    const definition = ce.lookupDefinition("Append");
    const operator =
      definition !== undefined && "operator" in definition
        ? (
            definition as {
              operator: {
                canonical?: (
                  ops: readonly BoxedExpression[],
                  options: unknown,
                ) => BoxedExpression | undefined;
              };
            }
          ).operator
        : undefined;
    if (operator !== undefined) {
      const nativeCanonical = operator.canonical;
      operator.canonical = (ops, options) => {
        if (ops.length === 2 && !NATIVE_APPEND_HEADS.has(ops[0].operator)) {
          return ce.function(ops[0].operator, [...operandsOf(ops[0]), ops[1]]);
        }
        return nativeCanonical?.call(operator, ops, options);
      };
    }
  }

  // SetMinus(list, list, …): Wolfram's Complement also takes lists, not just sets — a
  // `List` operand is read as the set of its elements before delegating to the native
  // set-difference computation, which already handles any number of operands.
  //
  // Widened first: compute-engine's native signature types the first parameter strictly
  // as `set<any>`, so boxing `SetMinus(List(...), …)` coerces the `List` operand into an
  // `Error` at BOX time — before this operator's `applies` guard, or even `evaluate`,
  // ever sees it (the same box-time coercion `At`'s `All`/`Span` cases ran into). Loosening
  // the parameter type to `any` avoids that eager coercion; the guard below still only
  // fires for an actual `List` operand.
  widenSignature(ce, "SetMinus", "(any, any*) -> set");
  wrapOperator(
    ce,
    ["SetMinus", 1, 1],
    (ops) => ops.some((op) => op.operator === "List"),
    (native) => (ops, options) =>
      native?.(
        ops.map((op) => (op.operator === "List" ? ce.box(["Set", ...operandsOf(op)]) : op)),
        options,
      ),
    { min: 2 },
  );
}
