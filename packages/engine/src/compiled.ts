// Epsil definitions compiled to JavaScript by compute-engine's own compiler: at run time, or
// ahead of time into a generated module. The Epsil is the definition; this is only how it runs
// fast. A separate entry (`@enumeratio/engine/compiled`), so only what compiles pulls in the
// compiler.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";

export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };
export type Js = number | boolean | readonly Js[];

/** A compiled definition: its free variables in, a plain JS value out. */
export type CompiledRun = (vars: Record<string, unknown>) => unknown;

/** Generated code's shape: compute-engine's runtime helpers and the free variables. */
export type GeneratedRun = (sys: unknown, vars: Record<string, unknown>) => unknown;

/** MathJSON integers and lists of them as plain JS, or undefined for anything else. */
export function toJs(json: unknown): Js | undefined {
  if (typeof json === "number") return Number.isInteger(json) ? json : undefined;
  if (!Array.isArray(json) || json[0] !== "List") return undefined;
  const out: Js[] = [];
  for (const item of json.slice(1)) {
    const value = toJs(item);
    if (value === undefined) return undefined;
    out.push(value);
  }
  return out;
}

/** The inverse of `toJs`; undefined for a value compiled code shouldn't have produced (a float
 *  where the interpreter would have kept a rational, say). */
export function fromJs(value: unknown): MathJSON | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
  if (typeof value === "boolean") return value ? "True" : "False";
  if (!Array.isArray(value)) return undefined;
  const out: MathJSON[] = ["List"];
  for (const item of value) {
    const json = fromJs(item);
    if (json === undefined) return undefined;
    out.push(json);
  }
  return out;
}

/** Every `Function`'s parameters renamed to fresh `_vN`, consistently within its body. The
 *  compiler's generated loops name their own variables (`i`, `_e`), and a parameter of ours with
 *  the same name is captured by them (cortex-js/compute-engine#367). Fresh names can't collide. */
export function freshen(expression: unknown): unknown {
  let next = 0;
  const walk = (node: unknown, names: ReadonlyMap<string, string>): unknown => {
    if (typeof node === "string") return names.get(node) ?? node;
    if (!Array.isArray(node)) return node;
    if (node[0] === "Function" && node.length >= 2) {
      const params = node.slice(2).filter((p): p is string => typeof p === "string");
      const inner = new Map(names);
      for (const param of params) inner.set(param, `_v${++next}`);
      return ["Function", walk(node[1], inner), ...params.map((param) => inner.get(param)!)];
    }
    return node.map((child) => walk(child, names));
  };
  return walk(expression, new Map());
}

interface Compilation {
  readonly run: CompiledRun & { SYS?: unknown };
  readonly code: string;
}

/** Compile `expression` with each free variable typed; undefined when the compiler declines. */
export function compileTyped(
  ce: ComputeEngine,
  expression: unknown,
  types: Readonly<Record<string, string>>,
): Compilation | undefined {
  ce.pushScope();
  try {
    for (const [name, type] of Object.entries(types)) ce.declare(name, type);
    const result = new JavaScriptTarget().compile(ce.box(freshen(expression) as never) as BoxedExpression) as {
      success?: boolean;
      run?: Compilation["run"];
      code?: string;
    };
    return result.success === true && result.run !== undefined && typeof result.code === "string"
      ? { run: result.run, code: result.code }
      : undefined;
  } catch {
    return undefined;
  } finally {
    ce.popScope();
  }
}

const helpersByEngine = new WeakMap<ComputeEngine, unknown>();

/** compute-engine's runtime helpers (`_SYS`), which generated code calls into. They belong to an
 *  engine (its random source, its streams), so each engine gets its own. Not exported by
 *  compute-engine, so taken from a function compiled on that engine. */
export function runtimeHelpers(ce: ComputeEngine): unknown {
  let helpers = helpersByEngine.get(ce);
  if (helpers === undefined) {
    helpers = compileTyped(ce, ["Add", "_h", 1], { _h: "integer" })?.run.SYS;
    if (helpers === undefined) throw new Error("compute-engine's compiled-code helpers are unavailable");
    helpersByEngine.set(ce, helpers);
  }
  return helpers;
}

/** A stable hash of a definition, so generated code is used only for the Epsil it came from.
 *  FNV-1a over the JSON, as eight hex digits. */
export function definitionHash(expression: unknown): string {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(expression)) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
