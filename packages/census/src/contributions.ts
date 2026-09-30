// What each package does to the engine (https://github.com/enumeratio/enumeratio/wiki/Manifest): declare every package in
// order, and note, for every head, which packages add it, re-sign it or replace its
// handler -- the type the engine then prints, whether it holds its arguments, and who had
// the head before. The manifest must say the same; `tests/manifest.test.ts` holds it to it.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { joinSignatures, type OverloadTable, overloadTable } from "@enumeratio/engine";
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
  /** The carriers this package's rows apply to, when every one of them names some (`on`). */
  on?: string[];
  /** The symbol patterns its rows apply to, when every row names carriers or symbols. */
  symbols?: string[];
  /** The carrier types its rows apply to, likewise. */
  types?: string[];
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
  // `name@pkg` where the package did more to a head with a table than add rows to it.
  const beyondRows = new Set<string>();
  for (const [pkg, declare] of PACKAGE_DECLARATIONS) {
    const tablesBefore = new Map<string, OverloadTable | undefined>();
    for (const name of before.keys()) tablesBefore.set(name, overloadTable(ce, name));
    declare(ce);
    const after = snapshot(ce);
    for (const [name, seen] of after) {
      const table = overloadTable(ce, name);
      if (table === undefined || !table.rows.some((row) => row.package === pkg)) continue;
      const was = before.get(name);
      const prior = tablesBefore.get(name);
      // Rows only: the handler around the table, the one under it and the head's own signature
      // are as they were (a table this step made wraps the head's handler, and nothing else).
      const outer = prior === undefined ? !table.wrapped : seen.evaluate === was?.evaluate;
      const native = prior?.native ?? was?.evaluate;
      const signature = prior !== undefined && !prior.resigned ? prior.nativeSignature : was?.type;
      if (
        !outer ||
        table.resigned ||
        table.native !== native ||
        table.nativeSignature !== signature ||
        seen.lazy !== was?.lazy
      )
        beyondRows.add(`${name}@${pkg}`);
    }
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
  // A head with a table: a package contributes its rows' own shapes, not the head's whole
  // signature after it.
  for (const [name, list] of out) {
    const table = overloadTable(ce, name);
    if (table === undefined) continue;
    // A row that adds no shape changes neither the head's handler nor its type once the table
    // is in place, so the loop above can't see its package: every package with a row counts.
    for (const pkg of new Set(table.rows.map((row) => row.package))) {
      if (list.some((c) => c.pkg === pkg)) continue;
      const lazy = list[0]?.lazy ?? false;
      list.push({ pkg, type: ce.type(table.nativeSignature).toString(), lazy, previous: list.at(-1)?.pkg ?? ENGINE });
    }
    for (const c of list) {
      // Rows that add no shape leave the package's say to whatever else it did to the head.
      const own = table.rows.filter((row) => row.package === c.pkg).flatMap((row) => row.signature ?? []);
      if (own.length > 0) c.type = ce.type(joinSignatures(own)).toString();
      const rows = table.rows.filter((row) => row.package === c.pkg);
      const conditional = rows.every(
        (row) => row.on !== undefined || row.symbols !== undefined || row.types !== undefined,
      );
      if (!beyondRows.has(`${name}@${c.pkg}`) && rows.length > 0 && conditional) {
        const on = [...new Set(rows.flatMap((row) => row.on ?? []))].toSorted();
        const symbols = [...new Set(rows.flatMap((row) => row.symbols ?? []))].toSorted();
        if (on.length > 0) c.on = on;
        if (symbols.length > 0) c.symbols = symbols;
        const types = [...new Set(rows.flatMap((row) => row.types ?? []))].toSorted();
        if (types.length > 0) c.types = types;
      }
    }
  }
  return out;
}
