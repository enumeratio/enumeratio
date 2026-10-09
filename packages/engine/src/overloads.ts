// Overloads as data (https://github.com/enumeratio/enumeratio/wiki/Speculative-Overloads-as-Data):
// a package's extension of a head it doesn't own is a row in that head's table, which the
// head dispatches from. Rows are ordered by what they are, never by who declared first, and
// the head's signature is computed from them, never assigned.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { declareCompile, extendHead } from "./extend.ts";
import { widenedSignature } from "./widen.ts";
import type { EvaluateOptions } from "./index.ts";

/** Lazy heads that only evaluate their operands, never hold or bind them. The wrapper has
 *  evaluated those already, so it hands the native handler the values: the written operands
 *  would be evaluated a second time (a `Sow` inside an `Add` would record twice). A head that
 *  holds its operands (`Do`, `Sum`) must get them as written. */
export const EVALUATES_OPERANDS: ReadonlySet<string> = new Set(["Add", "Multiply"]);

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
  /** Applies when an operand's type is one of these carrier types (`permutation`): for a
   *  carrier that is a type rather than a head. The resolver skips the package where it mints
   *  them all, since what makes such a value brings it. */
  readonly types?: readonly string[];
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
  /** `"builtin"`: the head compiles as the target's built-in lowering would (see `CompileStance`).
   *  A carrier row (`on`, `types`) fires only on operands compiled numeric code never sees, so it
   *  needs none; any other row states it, or closes the head. */
  readonly compile?: "builtin";
  /** The answer, or `undefined` to let the next row (or the head's own handler) try. */
  readonly evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => BoxedExpression | undefined;
}

type Evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) => BoxedExpression | undefined;

type OperatorLike = { signature?: unknown; evaluate?: Evaluate; lazy?: boolean };

/** What the engine has for a head right now, or `undefined` when it has no operator. */
const visibleOperator = (ce: ComputeEngine, head: string): OperatorLike | undefined => {
  const definition = ce.lookupDefinition(head);
  return definition !== undefined && "operator" in definition ? (definition.operator as OperatorLike) : undefined;
};

/**
 * Everything the engine's helpers have added to one head on one engine. `extend` builds a new
 * definition for each patch, so this record, not the definition, is what survives: the head's
 * signature and handler are always recomputed from it, never accumulated in patch order.
 */
interface Table {
  /** The head's own signature, with every `widenSignature` request joined in as one union. */
  base: string;
  /** Call shapes a package added as overloads of their own (`extendHead`'s `addSignature`). */
  readonly added: string[];
  /** What each `widenSignature` gate admits of the head's own handler. */
  readonly gates: ((op: BoxedExpression) => boolean)[];
  readonly rows: Overload[];
  ordered: Overload[];
  /** The handler the rows sit in front of: whatever `evaluate` the head had when they arrived. */
  native?: Evaluate;
  /** The dispatcher installed over it, to notice a handler wrapped around it from outside. */
  dispatch?: Evaluate;
  /** The signature last installed, to notice one assigned from outside. */
  computed?: string;
}

const tables = new WeakMap<ComputeEngine, Map<string, Table>>();

const isCarrierRow = (row: Overload): boolean => row.on !== undefined || row.types !== undefined;

/** How the head compiles with all its rows: the built-in lowering only if every row allows it. */
const rowsStance = (table: Table): "builtin" | undefined =>
  table.rows.every((row) => isCarrierRow(row) || row.compile === "builtin") ? "builtin" : undefined;

function tableOf(ce: ComputeEngine, head: string): Table | undefined {
  const known = tables.get(ce)?.get(head);
  if (known !== undefined) return known;
  const operator = visibleOperator(ce, head);
  if (operator === undefined) return undefined;
  const created: Table = { base: String(operator.signature), added: [], gates: [], rows: [], ordered: [] };
  const byHead = tables.get(ce) ?? new Map<string, Table>();
  byHead.set(head, created);
  tables.set(ce, byHead);
  return created;
}

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

/** The head's signature: its own, and every request's and row's. */
const signatureOf = (table: Table): string =>
  joinSignatures([table.base, ...table.added, ...table.rows.flatMap((row) => row.signature ?? [])]);

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

/** A head's table as declared on `ce`, or `undefined` while no package has added a row to it. */
export function overloadTable(ce: ComputeEngine, head: string): OverloadTable | undefined {
  const table = tables.get(ce)?.get(head);
  const operator = visibleOperator(ce, head);
  if (operator === undefined || table === undefined || table.rows.length === 0) return undefined;
  return {
    nativeSignature: table.base,
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
  (row.types === undefined || ops.some((op) => row.types!.includes(String(op.type)))) &&
  (row.unless === undefined || !ops.some((op) => row.unless!.includes(op.operator))) &&
  (row.when === undefined || row.when(ops));

function dispatcherOf(table: Table, lazy: boolean, head: string): Evaluate {
  return (ops, options) => {
    let values = ops;
    if (table.ordered.length > 0) {
      let written: Set<string> | undefined;
      const heads = (): Set<string> => (written ??= writtenHeads(ops));
      const candidates = table.ordered.filter((row) => mayApply(row, ops, heads));
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
    }
    const gates = [...table.gates, ...table.rows.flatMap((row) => row.native ?? [])];
    if (gates.length > 0 && !values.every((op) => gates.every((accepts) => accepts(op)))) return undefined;
    // See `EVALUATES_OPERANDS`: native would evaluate the written operands a second time.
    return table.native?.(lazy && EVALUATES_OPERANDS.has(head) ? values : ops, options);
  };
}

/**
 * Write what `table` holds onto the head: its signature, and the dispatcher once it is needed.
 * A widened base is assigned on the visible definition (a union is wider than what it had, so
 * `extend`, which only narrows, would refuse it); rows only ever narrow it, so they go through
 * `extend` as overloads.
 */
function install(ce: ComputeEngine, head: string, table: Table, widened: boolean): void {
  const operator = visibleOperator(ce, head);
  if (operator === undefined) return;
  const signature = signatureOf(table);
  // A collection-backed head only lets `extend` give it collection results, which a carrier
  // arm (`(permutation) -> permutation`) isn't: the signature is assigned directly there.
  const inPlace = widened || (operator as { collection?: unknown }).collection !== undefined;
  if (inPlace) operator.signature = ce.type(signature as never);
  const needsDispatch = table.rows.length > 0 || table.gates.length > 0;
  const patch: Record<string, unknown> = inPlace ? {} : { signature };
  if (needsDispatch && table.dispatch === undefined) {
    table.native = operator.evaluate;
    table.dispatch = dispatcherOf(table, operator.lazy === true, head);
    patch.evaluate = table.dispatch;
    patch.compile = rowsStance(table);
  }
  extendHead(ce, head, patch);
  if (needsDispatch && patch.compile === undefined) declareCompile(ce, head, rowsStance(table));
  table.computed = String(visibleOperator(ce, head)?.signature);
}

/** Add a call shape to a head as an overload of its own. Returns false when the engine has no such head. */
export function addHeadOverload(ce: ComputeEngine, head: string, signature: string): boolean {
  const table = tableOf(ce, head);
  if (table === undefined) return false;
  if (!table.added.includes(signature)) table.added.push(signature);
  install(ce, head, table, false);
  return true;
}

/**
 * Widen a head the engine already defines to also admit `signature` (one union with what it
 * admitted), and optionally gate what the head's own handler may be handed (see
 * `widenSignature`). Returns false when the engine has no such head.
 */
export function addHeadSignature(
  ce: ComputeEngine,
  head: string,
  signature: string,
  nativeAccepts?: (op: BoxedExpression) => boolean,
): boolean {
  const table = tableOf(ce, head);
  if (table === undefined) return false;
  table.base = widenedSignature(ce, table.base, signature);
  if (nativeAccepts !== undefined) table.gates.push(nativeAccepts);
  install(ce, head, table, true);
  return true;
}

/**
 * Add `overload` to `head`'s table on `ce`. The first row installs the dispatcher over the
 * head's own handler; each row recomputes the order and the signature, so which package
 * declared first doesn't matter. Returns false when the engine has no such head.
 */
export function defineOverload(ce: ComputeEngine, head: string, overload: Overload): boolean {
  const table = tableOf(ce, head);
  if (table === undefined) return false;
  table.rows.push(overload);
  table.ordered = order(table.rows);
  install(ce, head, table, false);
  return true;
}
