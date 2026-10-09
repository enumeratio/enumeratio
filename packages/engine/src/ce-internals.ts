// The one place that reads compute-engine internals the compile stance (extend.ts) depends on:
// which definition is the library's own, and which parts of one make an extension "a user definition"
// to the compiler (`library-shadowing`, 0.151). A compute-engine bump has to re-check both:
// tests/ce-internals.test.ts fails until `CHECKED_COMPUTE_ENGINE` is moved on with it.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { CompileHandler } from "./facade.ts";

/** The compute-engine version whose shadow rules this file was checked against. */
export const CHECKED_COMPUTE_ENGINE = "0.151.0";

/** The fields of a definition that, replaced, make an extension a shadow of the library head. */
export const SHADOWING_FIELDS = [
  "evaluate",
  "canonical",
  "derivative",
  "lazy",
  "broadcastable",
  "evaluateAsync",
] as const;

export type Operator = { compile?: CompileHandler } & { [K in (typeof SHADOWING_FIELDS)[number]]?: unknown };

type Scope = { parent?: Scope; bindings: { get(name: string): unknown } };

/** The operator the standard library declared `name` with: the one in the outermost scope. */
export function libraryOperator(ce: ComputeEngine, name: string): Operator | undefined {
  let scope = (ce as unknown as { context?: { lexicalScope?: Scope } }).context?.lexicalScope;
  if (scope === undefined) return undefined;
  while (scope.parent !== undefined) scope = scope.parent;
  const definition = scope.bindings.get(name);
  return typeof definition === "object" && definition !== null && "operator" in definition
    ? (definition.operator as Operator)
    : undefined;
}

/** Whether compute-engine would treat `operator` as a user definition shadowing the library head `name`. */
export function shadowsLibrary(ce: ComputeEngine, name: string, operator: Operator): boolean {
  const library = libraryOperator(ce, name);
  return (
    library !== undefined && operator !== library && SHADOWING_FIELDS.some((key) => operator[key] !== library[key])
  );
}
