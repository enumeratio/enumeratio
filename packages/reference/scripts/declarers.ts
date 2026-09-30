// Which library declares each name: see collect-declarers.ts. Shared with its drift test.

import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Library, plan as Plan } from "@enumeratio/manifest";

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

const changed = (before: readonly unknown[] | undefined, after: readonly unknown[]): boolean =>
  before === undefined || before.some((x, i) => x !== after[i]);

/** Each name, the libraries that declare or redefine it, in `libraries`' order. */
export function declarers(libraries: readonly Library<ComputeEngine>[], plan: typeof Plan): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const library of libraries) {
    const ce = new ComputeEngine();
    const needed = plan([library.name], libraries).libraries;
    for (const dep of needed) if (dep !== library) void dep.declare(ce);
    const before = snapshot(ce);
    void library.declare(ce);
    for (const [name, after] of snapshot(ce)) {
      if (!/^[A-Za-z]/.test(name) || !changed(before.get(name), after)) continue;
      (table[name] ??= []).push(library.name);
    }
  }
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return Object.fromEntries(
    Object.keys(table)
      .toSorted(cmp)
      .map((name) => [name, table[name]!]),
  );
}
