import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { referencesOrdinal } from "./reactive.ts";
import { headOf, opsOf, symOf } from "./symbols.ts";

/**
 * The symbol a cell assigns, if it is `name := ...`. Like `reactive.ts`'s `boundName`,
 * but read through `symbols.ts`'s generic `headOf`/`opsOf`/`symOf` rather than assuming
 * a plain-array MathJSON tree -- a cell's json here comes from `parseNotatio` (Epsil's
 * own decorated tree, `{ fn: [...] }` / `{ sym, sourceOffsets }`), where `reactive.ts`'s
 * worksheet always has the canonical array tree `engine.parse(...).json` already gives.
 */
function assignedName(json: MathJsonExpression): string | undefined {
  return headOf(json) === "Assign" ? symOf(opsOf(json)[0]) : undefined;
}

// `TrackedSymbols` -- Wolfram's option name -- is the capability that turns a
// `DynamicModule` reactive: Pluto.jl / marimo / Observable's rule (a cell that reads a
// changed symbol re-evaluates, transitively, in dependency order) under Wolfram's own
// spelling. It is one more option a `DynamicModule` can carry, not a second kind of
// module -- `undefined` is the DEFAULT configuration, a transcript in document order
// with `Out`/`In`/`InString` live (`transcript.ts`).
//
// This file is the pure, DOM-free half: given each cell's static bindings (what it
// assigns, what free symbols it reads -- found by boxing, never by evaluating), it
// builds the dependency graph, the evaluation order, and the errors a reactive module
// rejects a graph for. The element (`notatio-dynamic-module`) owns the DOM and the
// commit signal; this module only ever sees plain data.

/**
 * `All` / `Automatic` / `true` track every symbol any cell assigns; a list tracks only
 * those names. There is no "off" value here -- absence (`undefined`, read off the
 * `DynamicModule`'s own option) is what turns reactivity off, at the call site.
 */
export type TrackedSymbols = "All" | "Automatic" | true | readonly string[];

/** Is `name` one of the symbols `tracked` follows? */
export function isTracked(tracked: TrackedSymbols, name: string): boolean {
  return tracked === "All" || tracked === "Automatic" || tracked === true || tracked.includes(name);
}

/**
 * One cell's static dependency facts: what it assigns (`:=`), the free symbols it
 * reads, and whether it attempted a cell-number reference. Found once, without
 * evaluating anything -- `cellBindings` below is the usual way to get one from a
 * parsed cell; a test can also build these directly.
 */
export interface CellBindings {
  /** Stable identity -- the notatio-cell element's slot, or a test's own index. */
  readonly id: number;
  /** `undefined` for a cell that assigns nothing (an expression, not a binding). */
  readonly assigns?: string;
  /** Free symbols read, sorted; excludes the cell's own `assigns` name. */
  readonly reads: readonly string[];
  /** True if the source used a cell-number reference (`@_n`, `In(n)`, `Out(n)`, ...). */
  readonly ordinal: boolean;
}

/** `cell`'s bindings, from its source and parsed-but-unevaluated MathJSON. */
export function cellBindings(
  engine: ComputeEngine,
  id: number,
  source: string,
  json: MathJsonExpression | undefined,
): CellBindings {
  const ordinal = referencesOrdinal(source, json);
  if (json === undefined) return { id, reads: [], ordinal };
  const assigns = assignedName(json);
  let boxed: BoxedExpression | undefined;
  try {
    boxed = engine.box(json);
  } catch {
    return { id, assigns, reads: [], ordinal };
  }
  const reads = [...new Set(boxed.unknowns)].filter((n) => n !== assigns).sort();
  return { id, assigns, reads, ordinal };
}

export interface Diagnostic {
  readonly cellId: number;
  readonly message: string;
}

export interface Schedule {
  /** Dependency-first evaluation order over the cells with no diagnostic against them. */
  readonly order: readonly number[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * The reactive schedule for a module's cells: a topological order over the
 * assigns/reads graph, and the errors a reactive module rejects a graph for --
 *
 * - a **cell-number reference** (`referencesOrdinal`), because position/`Out(n)`
 *   conflicts with a module that reorders freely (the transcript configuration keeps
 *   allowing these; a caller only reaches this function once `TrackedSymbols` is set);
 * - **one definition per name** (Pluto/marimo's rule): two cells assigning the same
 *   symbol is an error shown on both, never last-writer-wins;
 * - a **cycle**, every member cited.
 *
 * Document order (`id` order, the caller's own numbering) breaks ties among cells with
 * no dependency between them, so an independent pair keeps reading top to bottom.
 */
export function schedule(cells: readonly CellBindings[]): Schedule {
  const diagnostics: Diagnostic[] = [];

  for (const cell of cells) {
    if (cell.ordinal) {
      diagnostics.push({
        cellId: cell.id,
        message: "cell-number references aren't valid in a reactive module -- bind a variable with := instead",
      });
    }
  }

  const definedBy = new Map<string, number[]>();
  for (const cell of cells) {
    if (cell.assigns === undefined) continue;
    const ids = definedBy.get(cell.assigns) ?? [];
    ids.push(cell.id);
    definedBy.set(cell.assigns, ids);
  }
  for (const [name, ids] of definedBy) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      diagnostics.push({ cellId: id, message: `\`${name}\` is defined in more than one cell` });
    }
  }

  // An edge runs from the cell that assigns a name to every cell that reads it. Only a
  // name with exactly one definer has a well-defined source; a duplicate has already
  // been reported above and contributes no edge.
  const singleDefiner = new Map<string, number>();
  for (const [name, ids] of definedBy) if (ids.length === 1) singleDefiner.set(name, ids[0]!);
  const edgesOut = new Map<number, number[]>(cells.map((c) => [c.id, []]));
  for (const cell of cells) {
    for (const name of cell.reads) {
      const definer = singleDefiner.get(name);
      if (definer !== undefined && definer !== cell.id) edgesOut.get(definer)?.push(cell.id);
    }
  }

  // Kahn's algorithm over the cells that have no diagnostic yet -- a duplicate
  // definition has no position to run at, so it is excluded from the order entirely.
  const bad = new Set(diagnostics.map((d) => d.cellId));
  const live = cells.filter((c) => !bad.has(c.id)).sort((a, b) => a.id - b.id);
  const indegree = new Map<number, number>(live.map((c) => [c.id, 0]));
  for (const cell of live) {
    for (const reader of edgesOut.get(cell.id) ?? []) {
      if (indegree.has(reader)) indegree.set(reader, (indegree.get(reader) ?? 0) + 1);
    }
  }
  const ready = live.filter((c) => indegree.get(c.id) === 0).map((c) => c.id);
  const order: number[] = [];
  const seen = new Set<number>();
  while (ready.length) {
    ready.sort((a, b) => a - b); // document order among cells that are equally ready
    const id = ready.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const reader of edgesOut.get(id) ?? []) {
      if (!indegree.has(reader)) continue;
      const next = (indegree.get(reader) ?? 0) - 1;
      indegree.set(reader, next);
      if (next === 0) ready.push(reader);
    }
  }
  if (order.length < live.length) {
    const stuck = live.map((c) => c.id).filter((id) => !seen.has(id));
    const byId = new Map(cells.map((c) => [c.id, c] as const));
    const names = stuck.map((id) => byId.get(id)?.assigns ?? `cell ${id}`);
    for (const id of stuck) diagnostics.push({ cellId: id, message: `cycle: ${names.join(" -> ")}` });
  }

  return { order, diagnostics };
}

/**
 * The cells to (re-)run after `changed` commits a new input: `changed` itself, then
 * every cell downstream of it transitively, along edges whose symbol `tracked` follows
 * -- so a `tracked` list that does not name what `changed` assigns still re-runs
 * `changed` but propagates no further. Returned in `sched`'s evaluation order.
 */
export function affected(
  cells: readonly CellBindings[],
  sched: Schedule,
  changed: number,
  tracked: TrackedSymbols,
): number[] {
  if (!cells.some((c) => c.id === changed)) return [];
  const definedBy = new Map<string, number>();
  for (const cell of cells) if (cell.assigns !== undefined) definedBy.set(cell.assigns, cell.id);

  const dirty = new Set<number>([changed]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const cell of cells) {
      if (dirty.has(cell.id)) continue;
      const depends = cell.reads.some((name) => {
        const definer = definedBy.get(name);
        return definer !== undefined && dirty.has(definer) && isTracked(tracked, name);
      });
      if (depends) {
        dirty.add(cell.id);
        grew = true;
      }
    }
  }
  // `changed` may itself carry a diagnostic (e.g. a duplicate definition) and so be
  // absent from `sched.order`; it still ran, so it still belongs in the result.
  const ordered = sched.order.filter((id) => dirty.has(id));
  return sched.order.includes(changed) || ordered.includes(changed) ? ordered : [changed, ...ordered];
}
