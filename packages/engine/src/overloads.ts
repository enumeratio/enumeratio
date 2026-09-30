// Overloads as data (https://github.com/enumeratio/enumeratio/wiki/Speculative-Overloads-as-Data):
// a package's extension of a head it doesn't own is a row in that head's table, which the
// head dispatches from. Rows are ordered by what they are, never by who declared first, and
// the head's signature is computed from them, never assigned.

import type { BoxedExpression, ComputeEngine, EvaluateOptions } from "@cortex-js/compute-engine";

type Arity = number | { readonly min: number; readonly max?: number };

export interface Overload {
  /** The package the row belongs to, as the manifest names it. */
  readonly package: string;
  /** The call shape it adds, as a compute-engine signature; joins the head's own. */
  readonly signature?: string;
  /** Applies when an operand's head is one of these (a carrier: `Adele`, `ProfiniteNumber`). */
  readonly on?: readonly string[];
  /** … and no operand's head is one of these. */
  readonly unless?: readonly string[];
  readonly arity?: Arity;
  /** Any further condition, over the evaluated operands. */
  readonly when?: (ops: readonly BoxedExpression[]) => boolean;
  /** Packages whose rows this one is tried before, where both would apply. */
  readonly overrides?: readonly string[];
  /** What the head's own handler accepts, when this row's signature lets more through: the
   *  handler only sees calls every row's `native` gate passes. */
  readonly native?: (op: BoxedExpression) => boolean;
  /** The answer, or `undefined` to let the next row (or the head's own handler) try. */
  readonly evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => BoxedExpression | undefined;
}

type Evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) => BoxedExpression | undefined;

interface Operator {
  signature: unknown;
  evaluate?: Evaluate;
  lazy?: boolean;
}

interface Table {
  readonly native: Evaluate | undefined;
  readonly nativeSignature: string;
  readonly rows: Overload[];
  ordered: Overload[];
}

const tables = new WeakMap<Operator, Table>();

const fits = (arity: Arity | undefined, n: number): boolean =>
  arity === undefined || (typeof arity === "number" ? n === arity : n >= arity.min && n <= (arity.max ?? Infinity));

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The rows in the order they're tried: carrier rows (`on`) before general ones, then by
 * package name, except that a row goes ahead of the packages it `overrides`. A package's own
 * rows keep the order it gave them.
 */
function order(rows: readonly Overload[]): Overload[] {
  const byClass = (row: Overload): number => (row.on === undefined ? 1 : 0);
  const sorted = rows
    .map((row, i) => ({ row, i }))
    .toSorted((a, b) => byClass(a.row) - byClass(b.row) || cmp(a.row.package, b.row.package) || a.i - b.i)
    .map(({ row }) => row);
  // A stable pass that lifts each overriding row ahead of the first row it overrides.
  const out: Overload[] = [];
  for (const row of sorted) {
    const at = out.findIndex(
      (placed) => byClass(placed) === byClass(row) && row.overrides?.includes(placed.package) === true,
    );
    if (at < 0) out.push(row);
    else out.splice(at, 0, row);
  }
  return out;
}

/** Call shapes as one intersection, in a canonical order. */
export function joinSignatures(signatures: readonly string[]): string {
  const shapes = [...new Set(signatures)];
  // An intersection already is one (and wrapping it whole breaks the `where` clauses inside).
  const shape = (s: string): string => (s.includes("&") ? s : `(${s})`);
  return shapes.length === 1 ? shapes[0]! : shapes.toSorted(cmp).map(shape).join(" & ");
}

/** The head's signature: its own, and every row's. */
const signatureOf = (table: Table): string =>
  joinSignatures([table.nativeSignature, ...table.rows.flatMap((row) => row.signature ?? [])]);

/** A head's table as declared on `ce`: its own signature and its rows, or `undefined`. */
export function overloadTable(
  ce: ComputeEngine,
  head: string,
): { readonly nativeSignature: string; readonly rows: readonly Overload[] } | undefined {
  const definition = ce.lookupDefinition(head);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const table = operator === undefined ? undefined : tables.get(operator as Operator);
  return table === undefined ? undefined : { nativeSignature: table.nativeSignature, rows: table.rows };
}

const matches = (row: Overload, ops: readonly BoxedExpression[]): boolean =>
  fits(row.arity, ops.length) &&
  (row.on === undefined || ops.some((op) => row.on!.includes(op.operator))) &&
  (row.unless === undefined || !ops.some((op) => row.unless!.includes(op.operator))) &&
  (row.when === undefined || row.when(ops));

/**
 * Add `overload` to `head`'s table on `ce`. The first row installs the dispatcher over the
 * head's own handler; each row recomputes the order and the signature, so which package
 * declared first doesn't matter. Returns false when the engine has no such head.
 */
export function defineOverload(ce: ComputeEngine, head: string, overload: Overload): boolean {
  const definition = ce.lookupDefinition(head);
  const operator = (definition !== undefined && "operator" in definition ? definition.operator : undefined) as
    | Operator
    | undefined;
  if (operator === undefined) return false;

  let table = tables.get(operator);
  if (table === undefined) {
    const created: Table = {
      native: operator.evaluate,
      nativeSignature: String(operator.signature),
      rows: [],
      ordered: [],
    };
    table = created;
    tables.set(operator, created);
    const lazy = operator.lazy === true;
    operator.evaluate = (ops, options) => {
      if (created.ordered.length > 0) {
        // A lazy head (`Add`) hands over its operands as written; rows see them evaluated,
        // once per call however many rows there are.
        const values = lazy ? ops.map((op) => op.evaluate()) : ops;
        for (const row of created.ordered) {
          if (!matches(row, values)) continue;
          const answer = row.evaluate(values, options);
          if (answer !== undefined) return answer;
        }
        const gates = created.rows.flatMap((row) => row.native ?? []);
        if (gates.length > 0 && !values.every((op) => gates.every((accepts) => accepts(op)))) return undefined;
      }
      return created.native?.(ops, options);
    };
  }
  table.rows.push(overload);
  table.ordered = order(table.rows);
  operator.signature = ce.type(signatureOf(table));
  return true;
}
