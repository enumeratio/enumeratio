// Overloads as data (https://github.com/enumeratio/enumeratio/wiki/Speculative-Overloads-as-Data):
// a package's extension of a head it doesn't own is a row in that head's table, which the
// head dispatches from. Rows are ordered by what they are, never by who declared first, and
// the head's signature is computed from them, never assigned.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { EvaluateOptions } from "./index.ts";

type Arity = number | { readonly min: number; readonly max?: number };

export interface Overload {
  /** The package the row belongs to, as the manifest names it. */
  readonly package: string;
  /** The call shape it adds, as a compute-engine signature; joins the head's own. */
  readonly signature?: string;
  /** Applies when an operand's head is one of these (a carrier: `Adele`, `ProfiniteNumber`). */
  readonly on?: readonly string[];
  /** Applies only where an operand mentions a symbol whose name this pattern (a regular
   *  expression's source) matches: hypercomplex's generators, `i_1` or `e_2`. Data for the
   *  resolver, which loads the package only for an expression naming one; `when` checks it. */
  readonly symbols?: string;
  /** … and no operand's head is one of these. */
  readonly unless?: readonly string[];
  readonly arity?: Arity;
  /** Any further condition, over the evaluated operands. */
  readonly when?: (ops: readonly BoxedExpression[]) => boolean;
  /** Match `on` against the operands as written (one level under a `Negate`), before any is
   *  evaluated: cheap on a hot head, and sound only where the carrier is always written as
   *  itself, never produced by evaluating an operand (`Add(HenselLift(…), …)` is). */
  readonly written?: boolean;
  /** A cheap test over the operands as written, for a row with no `on`: when it fails, the row
   *  is passed over without evaluating anything (a hot head's sums and products mostly fail). */
  readonly gate?: (ops: readonly BoxedExpression[]) => boolean;
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
  /** The head's own signature, and whatever `widenSignature` has since assigned it. */
  nativeSignature: string;
  /** The signature the table last computed, to notice one assigned from outside it. */
  computed?: string;
  readonly rows: Overload[];
  ordered: Overload[];
  /** The handler the table installs, to notice one wrapped around it from outside. */
  dispatch?: Evaluate;
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

export interface OverloadTable {
  /** The head's own signature, with any widening the table has absorbed. */
  readonly nativeSignature: string;
  readonly rows: readonly Overload[];
  /** The head's own handler, which the rows fall back to. */
  readonly native: Evaluate | undefined;
  /** Something outside the table has wrapped the handler it installed. */
  readonly wrapped: boolean;
  /** Something outside the table has assigned a signature since it last computed one. */
  readonly resigned: boolean;
}

/** A head's table as declared on `ce`, or `undefined`. */
export function overloadTable(ce: ComputeEngine, head: string): OverloadTable | undefined {
  const definition = ce.lookupDefinition(head);
  const operator = (definition !== undefined && "operator" in definition ? definition.operator : undefined) as
    | Operator
    | undefined;
  const table = operator === undefined ? undefined : tables.get(operator);
  if (operator === undefined || table === undefined) return undefined;
  return {
    nativeSignature: table.nativeSignature,
    rows: table.rows,
    native: table.native,
    wrapped: operator.evaluate !== table.dispatch,
    resigned: String(operator.signature) !== table.computed,
  };
}

const operands = (op: BoxedExpression): readonly BoxedExpression[] =>
  (op as unknown as { ops?: readonly BoxedExpression[] }).ops ?? [];

/** The heads among the operands as written, and one level under a bare `Negate`, which is how
 *  `Subtract(a, x)` arrives. */
function writtenHeads(ops: readonly BoxedExpression[]): Set<string> {
  const heads = new Set<string>();
  for (const op of ops) {
    heads.add(op.operator);
    if (op.operator === "Negate") for (const inner of operands(op)) heads.add(inner.operator);
  }
  return heads;
}

/** Could `row` apply, judged from the operands as written, before evaluating any? */
const mayApply = (row: Overload, ops: readonly BoxedExpression[], heads: () => Set<string>): boolean => {
  if (!fits(row.arity, ops.length)) return false;
  if (row.written === true && row.on !== undefined) return row.on.some((head) => heads().has(head));
  return row.gate === undefined || row.gate(ops);
};

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
      let values = ops;
      if (created.ordered.length > 0) {
        let written: Set<string> | undefined;
        const heads = (): Set<string> => (written ??= writtenHeads(ops));
        const candidates = created.ordered.filter((row) => mayApply(row, ops, heads));
        if (candidates.length > 0) {
          // A lazy head (`Add`) hands over its operands as written; rows see them evaluated,
          // once per call however many rows there are.
          if (lazy) values = ops.map((op) => op.evaluate());
          for (const row of candidates) {
            if (!matches(row, values)) continue;
            const answer = row.evaluate(values, options);
            if (answer !== undefined) return answer;
          }
        }
        const gates = created.rows.flatMap((row) => row.native ?? []);
        if (gates.length > 0 && !values.every((op) => gates.every((accepts) => accepts(op)))) return undefined;
      }
      return created.native?.(ops, options);
    };
    created.dispatch = operator.evaluate;
  }
  const current = String(operator.signature);
  if (table.computed !== undefined && current !== table.computed) table.nativeSignature = current;
  table.rows.push(overload);
  table.ordered = order(table.rows);
  operator.signature = ce.type(signatureOf(table));
  table.computed = String(operator.signature);
  return true;
}
