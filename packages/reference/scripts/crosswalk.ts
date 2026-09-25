// The derivations behind `collect-crosswalk.ts`, kept apart from the script so the test can
// re-run them without rewriting the generated files.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { CrosswalkRecord } from "../src/crosswalk-data.ts";
import type { EngineSymbol } from "../src/engine-symbols-data.ts";

export type { CrosswalkRecord, EngineSymbol };

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

/** Every name bound in an engine's scope chain -- the same walk `@enumeratio/census` does. */
function bindings(ce: ComputeEngine): string[] {
  const internal = ce as unknown as { context: { lexicalScope: Scope } };
  const names = new Set<string>();
  let scope: Scope | undefined = internal.context.lexicalScope;
  while (scope !== undefined) {
    for (const name of scope.bindings.keys()) names.add(name);
    scope = scope.parent;
  }
  return [...names];
}

interface Definition {
  /** One string, or one per paragraph. */
  readonly description?: string | readonly string[];
  readonly wikidata?: string;
  readonly keywords?: readonly string[];
  readonly signature?: unknown;
  readonly type?: unknown;
}

/**
 * The engine's own namespace, as it describes itself: every PascalCase symbol a bare engine
 * binds, with the definition fields worth showing. Units and the lowercase scaffolding
 * (`limits`, `__unit__`) are left out -- they are not heads a reference page is about.
 */
export function engineSymbols(ce: ComputeEngine): EngineSymbol[] {
  const out: EngineSymbol[] = [];
  for (const name of bindings(ce).sort()) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) continue;
    const found = ce.lookupDefinition(name) as { operator?: Definition; value?: Definition } | undefined;
    const definition = found?.operator ?? found?.value;
    if (!definition) continue;
    // Signatures and types are boxed objects that print as their type string.
    const signature = `${(definition.signature ?? definition.type ?? "") as string}`;
    const description = Array.isArray(definition.description)
      ? definition.description.join(" ")
      : (definition.description as string | undefined);
    out.push({
      name,
      kind: found?.operator ? "operator" : "constant",
      ...(description ? { description } : {}),
      ...(signature ? { signature } : {}),
      ...(definition.wikidata ? { wikidata: definition.wikidata } : {}),
      ...(definition.keywords?.length ? { keywords: [...definition.keywords] } : {}),
    });
  }
  return out;
}

/** The shape of a compiled Fungrim rule we read: its id and the heads it mentions. */
export interface FungrimRule {
  readonly id: string;
  readonly heads: readonly string[];
}

/** The shape of an oracle mapping we read: head, arity, and a template per system. */
export interface OracleMapping {
  readonly head: string;
  readonly arity?: number;
  readonly emit: Readonly<Partial<Record<string, string>>>;
}

/**
 * A template is a call in the other system when it starts with a name -- `zeta($1, $2)`,
 * `lucas_number2($1, 1, -1)`. Operator templates (`($1 - $2)`, `[$*,]`) name nothing.
 */
const isCall = (template: string): boolean => /^[A-Za-z_][\w.]*\s*[([]/.test(template);

/**
 * Per head, everything derivable without a kernel: Fungrim entries by head, the Wolfram
 * symbol the transpiler vouches for, the oracle table's calls. Wolfram is taken from the
 * transpiler alone -- the oracle table's Wolfram column repeats it, and a bare name
 * collision with Wolfram's `System`` context is not a reference.
 */
export function crosswalk(
  names: readonly string[],
  rules: readonly FungrimRule[],
  wolframHeads: Readonly<Record<string, string>>,
  mappings: readonly OracleMapping[],
): CrosswalkRecord[] {
  const fungrimByHead = new Map<string, Set<string>>();
  for (const rule of rules) {
    const id = rule.id.replace(/^fungrim:/, "");
    for (const head of rule.heads) {
      const set = fungrimByHead.get(head) ?? new Set<string>();
      set.add(id);
      fungrimByHead.set(head, set);
    }
  }
  const records: CrosswalkRecord[] = [];
  for (const name of names) {
    const fungrimEntries = [...(fungrimByHead.get(name) ?? [])].sort();
    // A head map value is sometimes an expression rather than a symbol (`-Infinity`); only a
    // symbol has a reference page.
    const alias = wolframHeads[name];
    const wolfram = alias && /^[A-Z]\w*$/.test(alias) ? alias : undefined;
    const oracle = mappings
      .filter((m) => m.head === name)
      .flatMap((m) =>
        Object.entries(m.emit)
          .filter(([system, call]) => system !== "wolfram" && call !== undefined && isCall(call))
          .map(([system, call]) => ({
            system,
            call: call as string,
            ...(m.arity === undefined ? {} : { arity: m.arity }),
          })),
      );
    if (!fungrimEntries.length && !wolfram && !oracle.length) continue;
    records.push({
      name,
      ...(fungrimEntries.length ? { fungrimEntries } : {}),
      ...(wolfram ? { wolfram } : {}),
      ...(oracle.length ? { oracle } : {}),
    });
  }
  return records;
}
