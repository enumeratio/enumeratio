// The lazy-resolution loop (design/namespaces.md §5.1). Resolve BEFORE evaluating, so the
// synchronous evaluator is never asked to suspend:
//
//   parse -> find candidates -> resolve (async) -> declare -> box
//
// compute-engine (0.131+) parses `\operatorname{Foo}(3)` with `Foo` unknown as the
// application ["Foo", 3], and declaring `Foo` after the parse is fine, so the default parse
// stage is the ordinary canonical one. The parse stage is pluggable: a front end that must
// see the tree before compute-engine commits to a reading (e.g. to keep `a(b+c)` a product
// for names we don't claim) passes `rawParse`, and the candidate walk already understands
// the raw tree's ["InvisibleOperator", name, ["Delimiter", …]] applications.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { ResourceRegistry } from "./registry.ts";
import type { Resource } from "./types.ts";

/** A MathJSON expression, structurally. */
type Json = string | number | boolean | readonly Json[] | { readonly [key: string]: unknown };

/** Turns LaTeX source into the MathJSON the loop walks and finally boxes. */
export type ParseStage = (ce: ComputeEngine, latex: string) => Json;

/** The default parse stage: compute-engine's own reading. */
export const canonicalParse: ParseStage = (ce, latex) => ce.parse(latex).json as Json;

/** `parse` accepts a `canonical` option, but the public `ComputeEngine` interface omits it
 *  from the signature. Narrow structurally rather than widening the engine's type. */
interface RawParser {
  parse(latex: string, options: { canonical: false }): { json: Json };
}

/** A parse stage that keeps `InvisibleOperator` intact, for front ends that want to decide
 *  application-versus-product themselves. */
export const rawParse: ParseStage = (ce, latex) =>
  (ce as unknown as RawParser).parse(latex, { canonical: false }).json;

/** Install a resolved resource onto the engine. Returns false to decline, leaving the name
 *  undeclared. */
export type Install = (resource: Resource, ce: ComputeEngine) => boolean | Promise<boolean>;

const isRawApplication = (j: Json): j is [string, string, ...Json[]] =>
  Array.isArray(j) &&
  j[0] === "InvisibleOperator" &&
  typeof j[1] === "string" &&
  Array.isArray(j[2]) &&
  (j[2] as Json[])[0] === "Delimiter";

/**
 * Every name in `json` that is being APPLIED to something but is not yet a known operator —
 * the set a lazy loader has to resolve before boxing. Walks either a canonical or a raw tree.
 */
export function applicationCandidates(json: Json, ce?: ComputeEngine): string[] {
  const found = new Set<string>();
  const walk = (j: Json): void => {
    if (!Array.isArray(j)) return;
    if (isRawApplication(j)) found.add(j[1]);
    if (typeof j[0] === "string" && j[0] !== "InvisibleOperator") found.add(j[0]);
    for (const op of j.slice(1)) walk(op);
  };
  walk(json);
  return [...found].filter((name) => !isOperator(ce, name));
}

// The canonical parse gives an unknown applied name a placeholder VALUE definition; only an
// operator definition means the name is already served.
const isOperator = (ce: ComputeEngine | undefined, name: string): boolean => {
  const def = ce?.lookupDefinition?.(name);
  return def !== undefined && "operator" in def;
};

/**
 * Resolve, install and box — the whole loop. Returns the boxed canonical expression, with
 * every name the registry claimed now declared.
 *
 * `source` is either LaTeX (read by `parse`, `canonicalParse` unless given) or MathJSON,
 * where heads are explicit and no parse stage runs.
 */
export async function prepare(
  ce: ComputeEngine,
  source: string | Json,
  registry: ResourceRegistry,
  install: Install,
  parse: ParseStage = canonicalParse,
): Promise<BoxedExpression> {
  const json = typeof source === "string" ? parse(ce, source) : source;

  for (const name of applicationCandidates(json, ce)) {
    const resource = registry.resolve(name);
    if (resource) await install(resource, ce);
  }

  return ce.box(json as Parameters<ComputeEngine["box"]>[0]);
}
