// Epsil pieces for the families ranked through a table of completions: the table is built
// bottom-up by a `Fold` that appends one row at a time, bound with its type and read with `At`.
// A family that declares it as `FamilyEpsil.tables` has it built once per params, else it is
// built once per call. Shared by the lattice-path, set-partition, permutation and composition areas.

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
/** C(n, k), 0 outside 0 ≤ k ≤ n: compiled `Binomial` is undefined there. */
export const choose = (n: MathJSON, k: MathJSON): MathJSON => [
  "If",
  ["And", ["LessEqual", 0, k], ["LessEqual", k, n]],
  ["Binomial", n, k],
  0,
];

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
 * row s is `next(prev, s, c, here)`, where `prev(s', c')` reads an earlier row (s' < s,
 * 0 ≤ c' < width) and `here(c')` an earlier column of this row (c' < c). Rows are joined one per
 * step, so the table is copied rows times, not once per cell; each row is filled in place.
 */
export function rowTable(
  tag: string,
  rows: MathJSON,
  width: MathJSON,
  first: (c: string) => MathJSON,
  next: (
    prev: (s: MathJSON, c: MathJSON) => MathJSON,
    s: string,
    c: string,
    here: (c: MathJSON) => MathJSON,
  ) => MathJSON,
): MathJSON {
  const table = `${tag}_t`;
  const s = `${tag}_s`;
  const c = `${tag}_c`;
  const row = `${tag}_row`;
  const prev = (r: MathJSON, column: MathJSON): MathJSON => at(table, add(mul(r, width), column, 1));
  // A row is filled a cell at a time, in place: the interpreter keeps a `Map` lazy, so a table
  // of mapped rows would re-evaluate every earlier row on each read, exponential in the rows.
  const here = (column: MathJSON): MathJSON => at(row, add(column, 1));
  const cells = (value: MathJSON): MathJSON =>
    fold(
      ["ReplaceAt", row, add(c, 1), value],
      row,
      c,
      map(0, `${tag}_z`, upTo(0, sub(width, 1))),
      upTo(0, sub(width, 1)),
    );
  return fold(["Join", table, cells(next(prev, s, c, here))], table, s, cells(first(c)), upTo(1, sub(rows, 1)));
}

/** Pascal's triangle as a `rowTable`: C(s, c) for s = 0..rows − 1 and c = 0..width − 1. Read it
 *  with `cell`, so a binomial is a lookup, not a product per call. */
export const pascalTable = (tag: string, rows: MathJSON, width: MathJSON): MathJSON =>
  rowTable(
    tag,
    rows,
    width,
    (c) => iff(equal(c, 0), 1, 0),
    (prev, s, c) => iff(equal(c, 0), 1, add(prev(sub(s, 1), sub(c, 1)), prev(sub(s, 1), c))),
  );

/**
 * The digits of `_r` in the colex combinatorial number system over `digits` ranks and `universe`
 * values: c_1 < … < c_digits < universe with C(c_digits, digits) + … + C(c_1, 1) = `_r`
 * (`choose(c, i)` reads C(c, i)). A list whose entry i + 1 is c_i, entry 1 the rank left over.
 * Digits are found from the top: c_i is the greatest c, below c_(i+1), with C(c, i) at most what is
 * left, so the searches together span the universe once.
 */
export function colexDigits(
  tag: string,
  digits: MathJSON,
  universe: MathJSON,
  choose: (c: MathJSON, i: MathJSON) => MathJSON,
): MathJSON {
  const [state, i, c, best, left, found] = ["st", "i", "c", "best", "left", "found"].map((name) => `${tag}_${name}`);
  const cap = iff(equal(i, digits), universe, at(state, add(i, 2)));
  const search = fold(
    iff(["LessEqual", choose(c, i), left], c, best),
    best,
    c,
    sub(i, 1),
    upTo(sub(i, 1), sub(cap, 1)),
  );
  const step = lets(
    [
      [left, at(state, 1), "integer"],
      [found, search, "integer"],
    ],
    ["ReplaceAt", ["ReplaceAt", state, 1, sub(left, choose(found, i))], add(i, 1), found],
  );
  return fold(step, state, i, ["Join", ["List", "_r"], map(0, `${tag}_z`, upTo(1, digits))], ["Range", digits, 1, -1]);
}

/** T(s, c) of a table from `rowTable` bound as `name`, starting `offset` cells in when several
 *  tables share one list (`FamilyEpsil.tables` is a single list). */
export const cell =
  (name: string, width: MathJSON, offset?: MathJSON) =>
  (s: MathJSON, c: MathJSON): MathJSON =>
    at(name, add(...(offset === undefined ? [] : [offset]), mul(s, width), c, 1));
