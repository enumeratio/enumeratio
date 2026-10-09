import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { addHeadOverload } from "./overloads.ts";

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;

/** What a package may change on a head another package (or compute-engine) declared. */
export interface HeadPatch {
  evaluate?: OperatorDefinition["evaluate"];
  /** A call shape of its own: the head's signature becomes `old & this`, as an overload. */
  addSignature?: string;
  collection?: OperatorDefinition["collection"];
  broadcastable?: boolean;
  canonical?: OperatorDefinition["canonical"];
}

/**
 * Patch a head the engine already defines, keeping every field the patch doesn't name: a
 * thin layer over `ce.declare(name, patch, { extend: true })`, which builds a new definition
 * from the visible one rather than redeclaring the head. Returns false when the engine has no
 * operator by that name.
 *
 * `evaluate` is the exception: it is set on the visible definition, not passed to `extend`.
 * Extending with a handler makes compute-engine treat the head as a user definition, and
 * `Add` (or any head a package wraps) then stops compiling. The patch's other fields go
 * through `extend`, which is what keeps a library head a library head. A handler named here
 * replaces the earlier one, so callers that mean to layer capture the current one first
 * (`wrapOperator`). `addSignature` goes through the head's table (`addHeadOverload`), so
 * signatures from different packages join in one canonical order whoever arrives first.
 */
const extensions = new WeakSet<object>();

/** Whether `definition` is one `extendHead` built from an earlier one, not a declaration of its own. */
export const isExtension = (definition: unknown): boolean =>
  typeof definition === "object" && definition !== null && extensions.has(definition);

/** The definition each extension was built from, and the heads each engine extended. */
const bases = new WeakMap<object, object>();
const extended = new WeakMap<object, Set<string>>();

export function extendHead(ce: ComputeEngine, name: string, patch: HeadPatch & { signature?: string }): boolean {
  const definition = ce.lookupDefinition(name);
  if (definition === undefined || !("operator" in definition)) return false;
  const { addSignature, evaluate, ...rest } = patch;
  if (evaluate !== undefined) (definition.operator as { evaluate?: unknown }).evaluate = evaluate;
  if (addSignature !== undefined && !addHeadOverload(ce, name, addSignature)) return false;
  if (Object.keys(rest).length === 0) return true;
  try {
    ce.declare(name, rest as never, { extend: true } as never);
    const visible = ce.lookupDefinition(name) as object;
    extensions.add(visible);
    if (visible !== definition) bases.set(visible, definition);
    if (!extended.has(ce)) extended.set(ce, new Set());
    extended.get(ce)!.add(name);
  } catch {
    // A collection-backed head that carries a carrier arm (`(permutation) -> permutation`) fails
    // `extend`'s check that its result is a collection; the fields are set on the definition.
    Object.assign(definition.operator as object, rest);
  }
  return true;
}

const HANDLERS = ["evaluate", "canonical", "compile", "derivative"] as const;

/**
 * Give the library definition each extended head was built from the handlers the head now
 * has. compute-engine lowers a head by name (`Sin` to `Math.sin`) only while its visible
 * definition holds the library's own `evaluate`, `canonical`, `compile` and `derivative`; one
 * that replaced a handler is "a user definition that shadows the library operator", and the
 * head stops compiling. Packages set handlers in place on the visible definition, which after
 * a signature or flag extension is no longer the library's, so a compile calls this first:
 * `Sin(x)` then compiles however many packages extended and wrapped `Sin`.
 */
export function syncLibraryHandlers(ce: ComputeEngine): void {
  for (const name of extended.get(ce) ?? []) {
    const visible = ce.lookupDefinition(name) as { operator?: Record<string, unknown> } | undefined;
    if (visible?.operator === undefined) continue;
    for (let d = bases.get(visible); d !== undefined; d = bases.get(d)) {
      const operator = (d as { operator?: Record<string, unknown> }).operator;
      if (operator === undefined) continue;
      for (const key of HANDLERS) if (operator[key] !== visible.operator[key]) operator[key] = visible.operator[key];
    }
  }
}
