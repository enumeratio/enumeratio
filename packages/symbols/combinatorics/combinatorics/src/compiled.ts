// A map's Epsil definition, compiled to JavaScript by compute-engine's own compiler, and
// memoized by value. The Epsil is the definition; this is only how it runs fast. When the
// compiler can't take a definition yet, or a result isn't one it can hand back exactly (only
// integers and lists of them), the interpreter answers instead. tests/map-definitions.test.ts
// holds the two to the same answers.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";

type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };
type Js = number | boolean | readonly Js[];

interface Compiled {
  readonly run: (vars: Record<string, unknown>) => unknown;
}

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

/** The inverse of `toJs`; undefined for a result the compiled code shouldn't have produced
 *  (a float where the interpreter would have kept a rational, say). */
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
 *  the same name is captured by them: `Range(i + 1, n)` compiled to `(_e, i) => (i + 1) + i`,
 *  reading the loop index for our `i`. Fresh names can't collide. */
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

/** Compile `expression` with each placeholder typed; undefined when the compiler declines. */
export function compileTyped(
  ce: ComputeEngine,
  expression: unknown,
  types: Readonly<Record<string, string>>,
): Compiled | undefined {
  ce.pushScope();
  try {
    for (const [name, type] of Object.entries(types)) ce.declare(name, type);
    const result = new JavaScriptTarget().compile(ce.box(freshen(expression) as never) as BoxedExpression) as {
      success?: boolean;
      run?: Compiled["run"];
    };
    return result.success === true && result.run !== undefined ? { run: result.run } : undefined;
  } catch {
    return undefined;
  } finally {
    ce.popScope();
  }
}

/** One map's definition as a function of its argument's contents: compiled where it compiles,
 *  interpreted otherwise, memoized either way. `undefined` declines (the guard failed). */
export function fastDefinition(options: {
  ce: ComputeEngine;
  body: unknown;
  guard?: unknown;
  from?: string;
  to?: string;
  interpret: (contents: unknown) => unknown;
}): (contents: unknown) => MathJSON | undefined {
  const { ce, body, guard, from, to, interpret } = options;
  let compiled: { body: Compiled; guard?: Compiled } | null | undefined;
  const compile = (): { body: Compiled; guard?: Compiled } | null => {
    if (from === undefined || to === undefined) return null;
    const main = compileTyped(ce, body, { _raw: from });
    if (main === undefined) return null;
    if (guard === undefined) return { body: main };
    const check = compileTyped(ce, guard, { _raw: from, _image: to });
    return check === undefined ? null : { body: main, guard: check };
  };
  const memo = new Map<string, MathJSON | null>();
  return (contents) => {
    const key = JSON.stringify(contents);
    const known = memo.get(key);
    if (known !== undefined) return known ?? undefined;
    compiled ??= compile();
    const raw = compiled === null ? undefined : toJs(contents);
    let answer: MathJSON | undefined;
    let answered = false;
    if (compiled !== null && raw !== undefined) {
      try {
        const image = compiled.body.run({ _raw: raw });
        const json = fromJs(image);
        if (json !== undefined) {
          answered = true;
          if (compiled.guard !== undefined && compiled.guard.run({ _raw: raw, _image: image }) !== true)
            answer = undefined;
          else answer = json;
        }
      } catch {
        answered = false;
      }
    }
    if (!answered) answer = interpret(contents) as MathJSON | undefined;
    if (memo.size > 50_000) memo.clear();
    memo.set(key, answer ?? null);
    return answer;
  };
}
