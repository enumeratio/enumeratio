import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigRationalAt,
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";

// compute-engine's core heads — lists, statistics, elementary functions — widened to the call
// forms and exact values Wolfram's take, where no domain package owns the head. Every wrapper
// answers only what the native handler rejects or leaves unevaluated, and hands everything
// else to it, so no result compute-engine already gives changes.

/** The columns of a rectangular matrix — a List of equally long Lists — or undefined. */
function columnsOf(
  ce: ComputeEngine,
  matrix: BoxedExpression | undefined,
): BoxedExpression[] | undefined {
  if (matrix?.operator !== "List") return undefined;
  const rows = operandsOf(matrix);
  if (rows.length === 0 || rows.some((row) => row.operator !== "List")) return undefined;
  const width = operandsOf(rows[0]).length;
  if (width === 0 || rows.some((row) => operandsOf(row).length !== width)) return undefined;
  return Array.from({ length: width }, (_, j) =>
    ce.function(
      "List",
      rows.map((row) => operandsOf(row)[j]!),
    ),
  );
}

/** A rational literal as [numerator, denominator], or undefined. */
const rationalOf = (op: BoxedExpression | undefined): readonly [bigint, bigint] | undefined =>
  op?.type.matches("rational") ? bigRationalAt(op) : undefined;

export function declareKernel(ce: ComputeEngine): void {
  // First(xs, default) and Last(xs, default): the default instead of Missing for an empty
  // collection, as Wolfram's First[{}, d] gives d.
  for (const head of ["First", "Last"]) {
    widenSignature(ce, head, "(indexed_collection<any>, any?) -> any");
    wrapOperator(
      ce,
      [head, ["List", 1]],
      (ops) => ops.length === 2,
      (native) => (ops, options) => {
        const found = native?.(ops.slice(0, 1), options);
        if (found === undefined) return undefined;
        return symbolNameOf(found) === "Missing" ? ops[1] : found;
      },
    );
  }

  // Ordering(xs, n): the first n positions of the full ordering, or the last −n.
  widenSignature(ce, "Ordering", "(indexed_collection<any>, any?) -> list<integer>");
  wrapOperator(
    ce,
    ["Ordering", ["List", 1]],
    (ops) => integerAt(ops[1]) !== undefined,
    (native) => (ops, options) => {
      const full = native?.(ops.slice(0, 1), options);
      if (full === undefined) return undefined;
      const n = integerAt(ops[1])!;
      const positions = operandsOf(full);
      return ce.function("List", n >= 0 ? positions.slice(0, n) : positions.slice(n));
    },
  );

  // Mean and Median of a matrix are taken column by column, as Wolfram's are; natively a
  // nested list is a type error.
  for (const head of ["Mean", "Median"]) {
    wrapOperator(
      ce,
      [head, ["List", 1]],
      (ops) => ops.length === 1 && columnsOf(ce, ops[0]) !== undefined,
      (native) => (ops, options) =>
        ce.function(
          "List",
          columnsOf(ce, ops[0])!.map(
            (column) => native?.([column], options) ?? ce.function(head, [column]),
          ),
        ),
    );
  }

  // Clamp(x) clips to [−1, 1], as Wolfram's Clip[x] does (and as the transpiler already
  // writes it, see @enumeratio/wolfram's to-wolfram.ts).
  const extended = "real | signed_infinity";
  widenSignature(ce, "Clamp", `(${extended}, (${extended})?, (${extended})?) -> ${extended}`);
  wrapOperator(
    ce,
    ["Clamp", 1, 0, 2],
    (ops) => ops.length === 1,
    (native) => (ops, options) => native?.([ops[0]!, ce.NegativeOne, ce.One], options),
  );

  // Length of a number is 0 — an atom has no parts — where natively it is a type error.
  // Only something typed as a number: an unknown symbol might yet stand for a collection.
  wrapOperator(
    ce,
    ["Length", ["List"]],
    (ops) => ops.length === 1 && ops[0]!.type.matches("number"),
    () => () => ce.Zero,
  );

  // ln(−q) = ln(q) + iπ for a positive rational q: the principal value, which compute-engine
  // already gives numerically (N(Ln(−1)) is iπ) but leaves standing exactly.
  wrapOperator(
    ce,
    ["Ln", 2],
    (ops) => ops.length === 1 && (rationalOf(ops[0])?.[0] ?? 0n) < 0n,
    () => (ops) =>
      ce
        .function("Add", [
          ce.function("Ln", [ops[0]!.neg()]),
          ce.function("Multiply", [ce.I, ce.Pi]),
        ])
        .evaluate(),
  );
}
