// Epsil pieces for the families ranked through a table of completions: the table is built once
// per call, bottom-up, by a `Fold` that appends one row at a time, bound with its type and read
// with `At`. Shared by the lattice-path and set-partition areas.

type MathJSON = unknown;

// Every Range states its step: compute-engine counts down when the end is below the start.
export const upTo = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, 1];
export const add = (...xs: MathJSON[]): MathJSON => ["Add", ...xs];
export const sub = (a: MathJSON, b: MathJSON): MathJSON => ["Subtract", a, b];
export const mul = (...xs: MathJSON[]): MathJSON => ["Multiply", ...xs];
export const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
export const equal = (a: MathJSON, b: MathJSON): MathJSON => ["Equal", a, b];
export const less = (a: MathJSON, b: MathJSON): MathJSON => ["Less", a, b];
export const and = (...xs: MathJSON[]): MathJSON => ["And", ...xs];
export const iff = (condition: MathJSON, then: MathJSON, otherwise: MathJSON): MathJSON => [
  "If",
  condition,
  then,
  otherwise,
];
export const fold = (
  body: MathJSON,
  accumulator: string,
  variable: string,
  init: MathJSON,
  over: MathJSON,
): MathJSON => ["Fold", ["Function", body, accumulator, variable], init, over];
export const map = (body: MathJSON, variable: string, over: MathJSON): MathJSON => [
  "Map",
  ["Function", body, variable],
  over,
];
/** ⌊a / b⌋ for integers, exactly: compute-engine's `Floor` of a big rational rounds through a double. */
export const quotient = (a: MathJSON, b: MathJSON): MathJSON => ["Divide", sub(a, ["Mod", a, b]), b];
export const len: MathJSON = ["Length", "_x"];

/** `body` with `name` bound to `value` (a `let`). A list needs its type: an untyped lambda
 *  applied to a list maps over it. */
export const lets = (bindings: readonly (readonly [string, MathJSON, string?])[], body: MathJSON): MathJSON =>
  bindings.reduceRight<MathJSON>(
    (inner, [name, value, type]) => [
      "Apply",
      ["Function", inner, type === undefined ? name : ["Typed", name, `'${type}'`]],
      value,
    ],
    body,
  );

/** A list of integers bound once around `body`. */
export const withTable = (name: string, table: MathJSON, body: MathJSON): MathJSON =>
  lets([[name, table, "list<integer>"]], body);

/** Whether every `x` of `over` passes `condition`. */
export const all = (condition: (x: string) => MathJSON, over: MathJSON, x: string): MathJSON =>
  fold(and(`ok_${x}`, condition(x)), `ok_${x}`, x, "True", over);

/**
 * A table T(s, c) for s = 0..rows − 1 and c = 0..width − 1, flat by rows: row 0 is `first(c)`,
 * row s is `next(prev, s, c)`, where `prev(s', c')` reads an earlier row (s' < s, 0 ≤ c' < width).
 * Rows are joined one per step, so the table is copied rows times, not once per cell.
 */
export function rowTable(
  tag: string,
  rows: MathJSON,
  width: MathJSON,
  first: (c: string) => MathJSON,
  next: (prev: (s: MathJSON, c: MathJSON) => MathJSON, s: string, c: string) => MathJSON,
): MathJSON {
  const table = `${tag}_t`;
  const s = `${tag}_s`;
  const c = `${tag}_c`;
  const row = `${tag}_row`;
  const prev = (r: MathJSON, column: MathJSON): MathJSON => at(table, add(mul(r, width), column, 1));
  // A row is appended a cell at a time: the interpreter keeps a `Map` lazy, so a table of
  // mapped rows would re-evaluate every earlier row on each read, exponential in the rows.
  const cells = (value: MathJSON): MathJSON => fold(["Append", row, value], row, c, ["List"], upTo(0, sub(width, 1)));
  return fold(["Join", table, cells(next(prev, s, c))], table, s, cells(first(c)), upTo(1, sub(rows, 1)));
}

/** T(s, c) of a table from `rowTable` bound as `name`. */
export const cell =
  (name: string, width: MathJSON) =>
  (s: MathJSON, c: MathJSON): MathJSON =>
    at(name, add(mul(s, width), c, 1));
