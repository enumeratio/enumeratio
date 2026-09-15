import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { stringAt } from "@enumeratio/boxed";
import { catalogRegistry, ENUMERATIO } from "./resources.ts";
import type { ResourceRegistry } from "./registry.ts";
import type { Resource } from "./types.ts";

export interface CatalogOptions {
  /** Registry to resolve against. Defaults to the whole enumeratio catalog. */
  readonly registry?: ResourceRegistry;
  /** Contexts to put on the search path, so their names resolve unqualified. */
  readonly bless?: readonly string[];
}

/** A resource is ANSWERABLE when a head of its name is already declared on this engine —
 *  the promoted rung. We ask the engine rather than recording it in the data, so the
 *  registry never goes stale against what is actually declared. */
const headFor = (ce: ComputeEngine, r: Resource): string | undefined =>
  ce.lookupDefinition?.(r.name) ? r.name : undefined;

/**
 * Declare the resource resolver. ONE head covers the whole catalog:
 *
 *   Resource("Subsets")         -> the head, as a function value (promoted names only)
 *   Resource("Subsets", 4)      -> Subsets(4), evaluated
 *   Resource("enumeratio`DyckPaths")  -> qualified; ignores the search path
 *
 * A resource that resolves but has no head stays symbolic rather than erroring: it is a
 * real name with real metadata that this engine cannot evaluate, and saying so is the
 * honest answer.
 */
export function declareCatalog(ce: ComputeEngine, options: CatalogOptions = {}): ResourceRegistry {
  const registry = options.registry ?? catalogRegistry();
  registry.bless(...(options.bless ?? []));

  ce.declare("Resource", {
    signature: "(string, number*) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const spelling = stringAt(ops[0]);
      if (spelling === undefined) return undefined;
      const resource = registry.resolve(spelling);
      if (!resource) return undefined;
      const head = headFor(ce, resource);
      if (!head) return undefined;
      const args = ops.slice(1);
      if (args.length === 0) return ce.symbol(head);
      return ce.function(head, args).evaluate();
    },
  });

  return registry;
}

export { ENUMERATIO };
