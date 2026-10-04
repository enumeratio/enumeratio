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

export function extendHead(ce: ComputeEngine, name: string, patch: HeadPatch & { signature?: string }): boolean {
  const definition = ce.lookupDefinition(name);
  if (definition === undefined || !("operator" in definition)) return false;
  const { addSignature, evaluate, ...rest } = patch;
  if (evaluate !== undefined) (definition.operator as { evaluate?: unknown }).evaluate = evaluate;
  if (addSignature !== undefined && !addHeadOverload(ce, name, addSignature)) return false;
  if (Object.keys(rest).length === 0) return true;
  try {
    ce.declare(name, rest as never, { extend: true } as never);
    extensions.add(ce.lookupDefinition(name) as object);
  } catch {
    // A collection-backed head that carries a carrier arm (`(permutation) -> permutation`) fails
    // `extend`'s check that its result is a collection; the fields are set on the definition.
    Object.assign(definition.operator as object, rest);
  }
  return true;
}
