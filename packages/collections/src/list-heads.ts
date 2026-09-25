import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt, widenSignature, wrapOperator } from "@enumeratio/boxed";

// The core list/statistics heads compute-engine ships but doesn't fully answer yet —
// widened arities (First/Last's empty-collection default, Ordering's take-n, Clamp's
// 1-arg default range), matrix-aware Mean/Median, and a handful of Wolfram-matching
// overrides (Sort on strings, Union's sort, At(c, 0), Partition's ragged tail, Join's
// level argument). Plus two new heads, Commonest and Position, for cases where
// Wolfram's answer is a LIST where ours (Mode, IndexOf) stays a scalar.
//
// Each override only fires on the specific case compute-engine gets wrong or leaves
// unanswered; everything else falls through to the native handler untouched.

/** Ascending order: numeric/orderable via `isLess`/`isGreater`, lexicographic for strings. */
const naturalCompare = (a: BoxedExpression, b: BoxedExpression): number => {
  const as = stringAt(a);
  const bs = stringAt(b);
  if (as !== undefined && bs !== undefined) return as < bs ? -1 : as > bs ? 1 : 0;
  if (a.isLess(b) === true) return -1;
  if (a.isGreater(b) === true) return 1;
  return 0;
};

/** A non-empty $List$ of $List$s, all the same shape — what Mean/Median thread over column-wise. */
const isMatrixLike = (expr: BoxedExpression): boolean => {
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

/** Reduce a matrix column-wise by calling `native` (Mean/Median's own 1-arg logic) on each column. */
const threadOverColumns =
  (ce: ComputeEngine, native: (ops: readonly BoxedExpression[]) => BoxedExpression | undefined) =>
  (matrix: BoxedExpression): BoxedExpression | undefined => {
    const columns = columnsOf(operandsOf(matrix));
    const results = columns.map((column) => native([ce.box(["List", ...column])]));
    return results.some((r) => r === undefined)
      ? undefined
      : ce.box(["List", ...(results as BoxedExpression[])]);
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
  widenSignature(ce, "First", "(indexed_collection<any>, any?) -> any");
  wrapOperator(
    ce,
    ["First", 1, 1],
    () => true,
    (native) => (ops, options) =>
      operandsOf(ops[0]).length === 0 ? ops[1] : native?.([ops[0]], options),
    2,
  );
  widenSignature(ce, "Last", "(indexed_collection<any>, any?) -> any");
  wrapOperator(
    ce,
    ["Last", 1, 1],
    () => true,
    (native) => (ops, options) =>
      operandsOf(ops[0]).length === 0 ? ops[1] : native?.([ops[0]], options),
    2,
  );

  // Ordering(c, n): the first n indices of the full ordering, rather than only the whole
  // permutation. compute-engine's second slot is typed for a comparator only.
  widenSignature(ce, "Ordering", "(indexed_collection<any>, any?) -> list<integer>");
  wrapOperator(
    ce,
    ["Ordering", 1, 1],
    (ops) => integerAt(ops[1]) !== undefined,
    (native) => (ops, options) => {
      const n = integerAt(ops[1])!;
      const full = native?.([ops[0]], options);
      return full === undefined ? undefined : ce.box(["List", ...operandsOf(full).slice(0, n)]);
    },
    2,
  );

  // Mean/Median thread column-wise over a matrix (a list of equal-length rows), reusing
  // the native 1-arg logic on each column rather than reimplementing the arithmetic.
  for (const head of ["Mean", "Median"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isMatrixLike(ops[0]),
      (native) => (ops, options) =>
        threadOverColumns(ce, (columnOps) => native?.(columnOps, options))(ops[0]),
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

  // Length(atom): an atom has no parts, so its length is 0 — compute-engine raises a
  // type error instead. Length is unary; guard explicitly so a future widening of the
  // signature can't reach this rule with extra operands.
  wrapOperator(
    ce,
    ["Length", 1],
    () => true,
    (native) => (ops, options) => {
      const result = native?.(ops, options);
      return result?.operator === "Error" ? ce.Zero : result;
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
  // arguments at BOX time, through `operator.canonical`, before `evaluate` ever runs —
  // wrapping `evaluate` alone (as every other override here does) never fires. Both hooks
  // are wrapped so the override reaches a call whichever path reduces it.
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
    (ops) => joinsAtLevel(ops) !== undefined,
    () => (ops) => joinAtLevel(ce, joinsAtLevel(ops)!.lists, joinsAtLevel(ops)!.level),
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
      operator.canonical = (ops, options) => {
        const join = joinsAtLevel(ops);
        return join !== undefined
          ? joinAtLevel(ce, join.lists, join.level)
          : nativeCanonical?.(ops, options);
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
}
