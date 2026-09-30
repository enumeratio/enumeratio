// Which library declares each name: see collect-declarers.ts. Shared with its drift test.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { overloadTable } from "@enumeratio/engine";
import { type Library, namesOf, type plan as Plan } from "@enumeratio/manifest";

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

/** Every name the engine binds, with what would show that a library redefined it. */
function snapshot(ce: ComputeEngine): Map<string, readonly unknown[]> {
  const out = new Map<string, readonly unknown[]>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  for (; scope !== undefined; scope = scope.parent) {
    for (const [name, binding] of scope.bindings) {
      if (out.has(name)) continue;
      const def = ce.lookupDefinition(name) as
        | { operator?: { evaluate?: unknown; canonical?: unknown; signature?: unknown }; value?: unknown }
        | undefined;
      const op = def?.operator;
      out.set(name, [binding, op?.evaluate, op?.canonical, `${(op?.signature as string | undefined) ?? ""}`]);
    }
  }
  return out;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const changed = (before: readonly unknown[] | undefined, after: readonly unknown[]): boolean =>
  before === undefined || before.some((x, i) => x !== after[i]);

/** How many rows `pkg` has in `name`'s table: a row added to a table already in place changes
 *  neither the head's handler nor (without a shape of its own) its signature. */
const rowsOf = (ce: ComputeEngine, name: string, pkg: string): number =>
  overloadTable(ce, name)?.rows.filter((row) => row.package === pkg).length ?? 0;

/** Each name, the libraries that declare or redefine it, in `libraries`' order. */
export function declarers(libraries: readonly Library<ComputeEngine>[], plan: typeof Plan): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const library of libraries) {
    const ce = new ComputeEngine();
    const needed = plan([library.name], libraries).libraries;
    for (const dep of needed) if (dep !== library) void dep.declare(ce);
    const before = snapshot(ce);
    const rowsBefore = new Map([...before.keys()].map((name) => [name, rowsOf(ce, name, library.name)]));
    void library.declare(ce);
    for (const [name, after] of snapshot(ce)) {
      if (!/^[A-Za-z]/.test(name)) continue;
      const added = rowsOf(ce, name, library.name) > (rowsBefore.get(name) ?? 0);
      if (!added && !changed(before.get(name), after)) continue;
      (table[name] ??= []).push(library.name);
    }
  }
  return Object.fromEntries(
    Object.keys(table)
      .toSorted(cmp)
      .map((name) => [name, table[name]!]),
  );
}

const ARGUMENTS = ["x", "y", "z"];

/** Each head that canonicalises to others (`Lb(x)` is `Log(x, 2)`), with the heads it becomes,
 *  in an engine holding every library: an expression needs what it's rewritten to as well. */
export function canonicalNames(libraries: readonly Library<ComputeEngine>[]): Record<string, string[]> {
  const ce = new ComputeEngine();
  for (const library of libraries) void library.declare(ce);
  const out: Record<string, string[]> = {};
  for (const name of [...snapshot(ce).keys()].filter((n) => /^[A-Z]/.test(n)).toSorted(cmp)) {
    const reached = new Set<string>();
    for (let n = 1; n <= ARGUMENTS.length; n++) {
      let json: unknown;
      try {
        json = ce.box([name, ...ARGUMENTS.slice(0, n)]).json;
      } catch {
        continue;
      }
      const names = namesOf(json);
      // Unchanged, or not a call it takes (`Pi(x)`, a head at the wrong arity).
      if (names.has(name) || names.has("Error")) continue;
      for (const found of names) if (!ARGUMENTS.includes(found)) reached.add(found);
    }
    if (reached.size > 0) out[name] = [...reached].toSorted(cmp);
  }
  return out;
}

/** Each carrier type a library mints (`ce.declareType`), with the libraries that do, found as
 *  `declarers` finds names: each library into a fresh engine over what it requires. */
export function carrierTypes(
  libraries: readonly Library<ComputeEngine>[],
  plan: typeof Plan,
): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const library of libraries) {
    const ce = new ComputeEngine();
    for (const dep of plan([library.name], libraries).libraries) if (dep !== library) void dep.declare(ce);
    const declareType = ce.declareType.bind(ce);
    ce.declareType = (name, ...rest) => {
      const at = (table[name] ??= []);
      if (!at.includes(library.name)) at.push(library.name);
      return declareType(name, ...rest);
    };
    void library.declare(ce);
  }
  return Object.fromEntries(
    Object.keys(table)
      .toSorted(cmp)
      .map((name) => [name, table[name]!]),
  );
}
