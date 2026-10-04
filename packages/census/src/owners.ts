// Heads are declared once (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos §2.3).
//
// A head is declared by compute-engine, or by the package that introduces it. Every other
// package that wants the head contributes to it: a row in its overload table, a widened
// signature, a wrapped handler. What can't happen is a package redeclaring a head that's
// already declared, because then declaration order decides the winner, and two repos can't
// coordinate "declare me last". Two packages contributing one signature is the same clobber,
// a step later: neither can tell which answers.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { overloadTable } from "@enumeratio/engine";
import { contributions, ENGINE } from "./contributions.ts";
import { fullEngine, PACKAGE_DECLARATIONS } from "./engine.ts";

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

interface Identity {
  readonly definition: unknown;
  readonly operator: unknown;
  readonly value: unknown;
}

const headsOf = (ce: ComputeEngine): string[] => {
  const out = new Set<string>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  for (; scope !== undefined; scope = scope.parent) for (const name of scope.bindings.keys()) out.add(name);
  return [...out].filter((name) => /^[A-Z]/.test(name));
};

const identityOf = (ce: ComputeEngine, name: string): Identity | undefined => {
  const definition = ce.lookupDefinition(name) as { operator?: unknown; value?: unknown } | undefined;
  return definition === undefined ? undefined : { definition, operator: definition.operator, value: definition.value };
};

const snapshot = (ce: ComputeEngine): Map<string, Identity | undefined> =>
  new Map(headsOf(ce).map((name) => [name, identityOf(ce, name)]));

export interface HeadDeclaration {
  /** What declared the head: the engine, or the package that introduced it. */
  readonly declarer: string;
  /** Packages that declared it again afterwards, replacing its definition. Always empty, bar the known exceptions. */
  readonly redeclaredBy: readonly string[];
  /** The other packages that touch it: widen it, wrap its handler, add rows. */
  readonly contributors: readonly string[];
}

/**
 * Who declares each head our packages touch, found by declaring them in order and watching which
 * steps create a definition, which replace one, and which only reshape one in place.
 */
export function declarations(): Map<string, HeadDeclaration> {
  const touched = contributions();
  const ce = new ComputeEngine();
  const declarer = new Map<string, string>(headsOf(ce).map((name) => [name, ENGINE]));
  // Whose definition stands now, as each step leaves it.
  const current = new Map(declarer);
  const redeclaredBy = new Map<string, string[]>();
  let before = snapshot(ce);
  for (const [pkg, declare] of PACKAGE_DECLARATIONS) {
    declare(ce);
    const after = snapshot(ce);
    for (const [name, now] of after) {
      const was = before.get(name);
      if (now === undefined) continue;
      if (was === undefined) {
        declarer.set(name, pkg);
        current.set(name, pkg);
        continue;
      }
      const replaced = was.definition !== now.definition || was.operator !== now.operator || was.value !== now.value;
      // A package's later steps may rebind what its earlier ones declared.
      if (!replaced || current.get(name) === pkg) continue;
      redeclaredBy.set(name, [...(redeclaredBy.get(name) ?? []), pkg]);
      current.set(name, pkg);
    }
    before = after;
  }
  const out = new Map<string, HeadDeclaration>();
  // Values (`Primes`) have no signature for `contributions` to see, but can be redeclared too.
  for (const head of new Set([...touched.keys(), ...redeclaredBy.keys()])) {
    const list = touched.get(head) ?? [];
    const by = redeclaredBy.get(head) ?? [];
    const first = declarer.get(head) ?? ENGINE;
    out.set(head, {
      declarer: first,
      redeclaredBy: by,
      contributors: list.map((c) => c.pkg).filter((pkg) => pkg !== first),
    });
  }
  return out;
}

/**
 * Signatures two packages both contribute to one head: the rows in its overload table, which
 * `defineOverload` takes from any package without looking at the others.
 */
export function duplicateRows(): string[] {
  const ce = fullEngine();
  const out: string[] = [];
  for (const head of contributions().keys()) {
    const rows = overloadTable(ce, head)?.rows ?? [];
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.signature === undefined) continue;
      const key = JSON.stringify([row.signature, row.on, row.types, row.symbols, row.arity]);
      const other = seen.get(key);
      if (other !== undefined && other !== row.package)
        out.push(`${head}: ${other} and ${row.package} both give ${row.signature}`);
      else seen.set(key, row.package);
    }
  }
  return out;
}
