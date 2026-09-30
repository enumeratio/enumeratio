// What each package does to the engine (https://github.com/enumeratio/enumeratio/wiki/Manifest): declare every package in
// order, and note, for every head, which packages add it, re-sign it or replace its
// handler -- the type the engine then prints, whether it holds its arguments, and who had
// the head before. The manifest must say the same; `tests/manifest.test.ts` holds it to it.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { joinSignatures, overloadTable } from "@enumeratio/engine";
import { PACKAGE_DECLARATIONS } from "./engine.ts";

export const ENGINE = "compute-engine";

export interface Contribution {
  readonly pkg: string;
  /** The head's signature as the engine prints it after this package; for a head with a
   *  table (`defineOverload`), this package's rows' own call shapes. */
  type: string;
  lazy: boolean;
  /** Who had the head before this package: the engine, an earlier package, or nobody. */
  readonly previous?: string;
}

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}
interface Operator {
  readonly signature?: unknown;
  readonly lazy?: boolean;
  readonly evaluate?: unknown;
}
interface Seen {
  readonly type: string;
  readonly lazy: boolean;
  readonly evaluate: unknown;
}

function snapshot(ce: ComputeEngine): Map<string, Seen> {
  const names = new Set<string>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  for (; scope !== undefined; scope = scope.parent) for (const n of scope.bindings.keys()) names.add(n);
  const out = new Map<string, Seen>();
  for (const name of names) {
    if (!/^[A-Z]/.test(name)) continue;
    const op = (ce.lookupDefinition(name) as { operator?: Operator } | undefined)?.operator;
    if (op?.signature === undefined) continue;
    out.set(name, { type: `${op.signature as string}`, lazy: op.lazy === true, evaluate: op.evaluate });
  }
  return out;
}

/** Every head our packages touch, with each package's contribution in declaration order. */
export function contributions(): Map<string, Contribution[]> {
  const bare = snapshot(new ComputeEngine());
  const ce = new ComputeEngine();
  let before = snapshot(ce);
  const owner = new Map<string, string>();
  const out = new Map<string, Contribution[]>();
  for (const [pkg, declare] of PACKAGE_DECLARATIONS) {
    declare(ce);
    const after = snapshot(ce);
    for (const [name, seen] of after) {
      const was = before.get(name);
      if (was !== undefined && was.type === seen.type && was.lazy === seen.lazy && was.evaluate === seen.evaluate)
        continue;
      const list = out.get(name) ?? [];
      const mine = list.find((c) => c.pkg === pkg);
      if (mine !== undefined) {
        // A later step of the same package: its final say is what counts.
        mine.type = seen.type;
        mine.lazy = seen.lazy;
      } else {
        const previous = owner.get(name) ?? (bare.has(name) ? ENGINE : undefined);
        list.push({ pkg, type: seen.type, lazy: seen.lazy, ...(previous !== undefined ? { previous } : {}) });
      }
      out.set(name, list);
      owner.set(name, pkg);
    }
    before = after;
  }
  // A head with a table: a package contributes its rows' own shapes (or the head's own, for rows
  // that add none), not the head's whole signature after it.
  for (const [name, list] of out) {
    const table = overloadTable(ce, name);
    if (table === undefined) continue;
    for (const c of list) {
      const rows = table.rows.filter((row) => row.package === c.pkg);
      if (rows.length === 0) continue;
      const own = rows.flatMap((row) => row.signature ?? []);
      c.type = ce.type(own.length > 0 ? joinSignatures(own) : table.nativeSignature).toString();
    }
  }
  return out;
}
