// The one place that reads compute-engine internals the compile stance (extend.ts) and the modular
// fast path (modular.ts) depend on: which definition is the library's own, which parts of one make an
// extension "a user definition" to the compiler (`library-shadowing`, 0.152), and the prototype function
// nodes share. A compute-engine bump has to re-check all three:
// tests/ce-internals.test.ts fails until `CHECKED_COMPUTE_ENGINE` is moved on with it.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { CompileHandler } from "./facade.ts";

/** The compute-engine version whose shadow rules this file was checked against. */
export const CHECKED_COMPUTE_ENGINE = "0.174.0";

/** A canonical call of `name` on already-canonical operands, bypassing the head's own `canonical` handler. */
export const canonicalCall = (ce: ComputeEngine, name: string, ops: readonly unknown[]): unknown =>
  (ce as unknown as { _fn(h: string, o: readonly unknown[]): unknown })._fn(name, ops);

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

/** What compute-engine compares of an extension (the copy `ce.declare(..., { extend: true })` makes of a library head). */
const EXTENSION_SHADOWING_FIELDS = ["lazy", "broadcastable", "evaluateAsync"] as const;

/** The definitions `extendHead` built from an earlier one. */
export const extensions = new WeakSet<object>();

/**
 * Whether compute-engine would treat `operator` as a user definition shadowing the library head `name`.
 * An extension shadows only by what changes how operands are held or threaded: a replaced `evaluate` or
 * `canonical` on it still compiles as the library head, so a package that replaces one states its stance.
 */
export function shadowsLibrary(ce: ComputeEngine, name: string, operator: Operator, extension = false): boolean {
  const library = libraryOperator(ce, name);
  const fields: readonly (keyof Operator)[] = extension ? EXTENSION_SHADOWING_FIELDS : SHADOWING_FIELDS;
  return library !== undefined && operator !== library && fields.some((key) => operator[key] !== library[key]);
}

/** The `evaluate` entry points of function nodes, as `modular.ts` wraps them. */
export interface FunctionNodePrototype {
  evaluate?: unknown;
  evaluateAsync?: unknown;
}

/**
 * The prototype every function node of `ce`'s compute-engine copy shares, or undefined when it no longer
 * carries both `evaluate` and `evaluateAsync` (a bump that moved them: the fast path then stays off).
 */
export function functionNodePrototype(ce: ComputeEngine): FunctionNodePrototype | undefined {
  const sample = ce.function("Mod", [ce.number(1), ce.number(2)]);
  const prototype = Object.getPrototypeOf(sample) as FunctionNodePrototype | null;
  return prototype !== null && typeof prototype.evaluate === "function" && typeof prototype.evaluateAsync === "function"
    ? prototype
    : undefined;
}
