// The lazy-resolution loop (design/namespaces.md §5.1). Resolve BEFORE evaluating, so the
// synchronous evaluator is never asked to suspend:
//
//   parse non-canonically -> find candidates -> resolve (async) -> declare -> canonicalise
//
// The non-canonical parse is what makes this work. `\operatorname{Foo}(3)` with `Foo`
// unknown canonicalises to ["Multiply", 3, "Foo"] and cannot be repaired afterwards, but
// the RAW parse keeps ["InvisibleOperator", "Foo", ["Delimiter", 3]] — so the ambiguity is
// still there to resolve. Multi-argument application already parses undeclared; only the
// unary case needs this.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { ResourceRegistry } from "./registry.ts";
import type { Resource } from "./types.ts";

/** A MathJSON expression, structurally. */
type Json = string | number | boolean | readonly Json[] | { readonly [key: string]: unknown };

/** `parse` accepts a `canonical` option, but the public `ComputeEngine` interface omits it
 *  from the signature. Narrow structurally rather than widening the engine's type. */
interface RawParser {
  parse(latex: string, options: { canonical: false }): { json: Json };
}

/** The parse that keeps `InvisibleOperator` intact — see this file's header. */
export const rawParse = (ce: ComputeEngine, latex: string): Json =>
  (ce as unknown as RawParser).parse(latex, { canonical: false }).json;

/** Install a resolved resource onto the engine. Returns false to decline, leaving the name
 *  unresolved — a declined name stays a multiplication, which is the correct reading of
 *  `a(b+c)` for any `a` we do not claim. */
export type Install = (resource: Resource, ce: ComputeEngine) => boolean | Promise<boolean>;

const isApplication = (j: Json): j is [string, string, ...Json[]] =>
  Array.isArray(j) &&
  j[0] === "InvisibleOperator" &&
  typeof j[1] === "string" &&
  Array.isArray(j[2]) &&
  (j[2] as Json[])[0] === "Delimiter";

/**
 * Every name in `json` that is being APPLIED to something but is not yet a known operator —
 * the set a lazy loader has to resolve before canonicalisation commits.
 *
 * Walks the NON-canonical tree: pass `ce.parse(src, { canonical: false }).json`.
 */
export function applicationCandidates(json: Json, ce?: ComputeEngine): string[] {
  const found = new Set<string>();
  const walk = (j: Json): void => {
    if (!Array.isArray(j)) return;
    if (isApplication(j)) found.add(j[1]);
    // A head position is itself a candidate: multi-argument calls already parse as ["Foo", …]
    // even when Foo is unknown, so they never become an InvisibleOperator.
    if (typeof j[0] === "string" && j[0] !== "InvisibleOperator") found.add(j[0]);
    for (const op of j.slice(1)) walk(op);
  };
  walk(json);
  return [...found].filter((name) => !ce?.lookupDefinition?.(name));
}

/**
 * Resolve, install and canonicalise — the whole loop. Returns the boxed canonical
 * expression, with every name the registry claimed now declared.
 *
 * `source` is either LaTeX (parsed non-canonically here) or MathJSON, where heads are
 * explicit and the raw-parse step is unnecessary.
 */
export async function prepare(
  ce: ComputeEngine,
  source: string | Json,
  registry: ResourceRegistry,
  install: Install,
): Promise<BoxedExpression> {
  const raw = typeof source === "string" ? rawParse(ce, source) : source;

  for (const name of applicationCandidates(raw, ce)) {
    const resource = registry.resolve(name);
    if (resource) await install(resource, ce);
  }

  return ce.box(raw as Parameters<ComputeEngine["box"]>[0]);
}
