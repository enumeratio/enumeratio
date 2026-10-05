// What declaring a library into an engine finds, for its `declares.json` (collect-declares.ts),
// and the heads compute-engine's own canonicalise to, for the manifest's build.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { overloadTable } from "@enumeratio/engine";
import type { LibraryDeclares } from "../src/declares.ts";
import { namesOf } from "../src/names.ts";

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Every name the engine binds, with what would show that a library redefined it. */
export function snapshot(ce: ComputeEngine): Map<string, readonly unknown[]> {
  const out = new Map<string, readonly unknown[]>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  for (; scope !== undefined; scope = scope.parent) {
    for (const [name, binding] of scope.bindings) {
      if (out.has(name)) continue;
      const def = ce.lookupDefinition(name) as
        | {
            operator?: {
              evaluate?: unknown;
              canonical?: unknown;
              signature?: unknown;
              collection?: unknown;
              type?: unknown;
            };
          }
        | undefined;
      const op = def?.operator;
      // `collection` and `type` too: a patch can make a native head a collection in place
      // (QuotientRing), changing neither its handler nor its signature.
      out.set(name, [
        binding,
        op?.evaluate,
        op?.canonical,
        `${(op?.signature as string | undefined) ?? ""}`,
        op?.collection,
        op?.type,
      ]);
    }
  }
  return out;
}

const changed = (before: readonly unknown[] | undefined, after: readonly unknown[]): boolean =>
  before === undefined || before.some((x, i) => x !== after[i]);

/** How many rows `pkg` has in `name`'s table: a row added to a table already in place changes
 *  neither the head's handler nor (without a shape of its own) its signature. */
const rowsOf = (ce: ComputeEngine, name: string, pkg: string): number =>
  overloadTable(ce, name)?.rows.filter((row) => row.package === pkg).length ?? 0;

const ARGUMENTS = ["x", "y", "z"];

/** Each of `names` that canonicalises to other heads in `ce`, with the heads it becomes. */
export function canonicalOf(ce: ComputeEngine, names: Iterable<string>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const name of [...names].filter((n) => /^[A-Z]/.test(n)).toSorted(cmp)) {
    const reached = new Set<string>();
    for (let n = 1; n <= ARGUMENTS.length; n++) {
      let json: unknown;
      try {
        json = ce.box([name, ...ARGUMENTS.slice(0, n)]).json;
      } catch {
        continue;
      }
      const found = namesOf(json);
      // Unchanged, or not a call it takes (`Pi(x)`, a head at the wrong arity).
      if (found.has(name) || found.has("Error")) continue;
      for (const head of found) if (!ARGUMENTS.includes(head)) reached.add(head);
    }
    if (reached.size > 0) out[name] = [...reached].toSorted(cmp);
  }
  return out;
}

/** What `declare` (library `name`) finds in `ce`, which already holds what it requires: the
 *  names it adds or redefines, the heads those canonicalise to, and the types it mints. */
export async function declaresOf(
  ce: ComputeEngine,
  name: string,
  declare: (ce: ComputeEngine) => unknown,
): Promise<LibraryDeclares> {
  const types: string[] = [];
  const declareType = ce.declareType.bind(ce);
  ce.declareType = (type, ...rest) => {
    if (!types.includes(type)) types.push(type);
    return declareType(type, ...rest);
  };
  const before = snapshot(ce);
  const rowsBefore = new Map([...before.keys()].map((n) => [n, rowsOf(ce, n, name)]));
  await declare(ce);
  ce.declareType = declareType;

  const names: string[] = [];
  for (const [n, after] of snapshot(ce)) {
    if (!/^[A-Za-z]/.test(n)) continue;
    const added = rowsOf(ce, n, name) > (rowsBefore.get(n) ?? 0);
    if (added || changed(before.get(n), after)) names.push(n);
  }
  names.sort(cmp);
  const canonical = canonicalOf(ce, names);
  return {
    names,
    ...(Object.keys(canonical).length > 0 ? { canonical } : {}),
    ...(types.length > 0 ? { types: types.toSorted(cmp) } : {}),
  };
}
