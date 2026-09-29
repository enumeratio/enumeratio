// A map's Epsil definition, compiled to JavaScript by compute-engine's own compiler, and
// memoized by value. The Epsil is the definition; this is only how it runs fast. When the
// compiler can't take a definition yet, or a result isn't one it can hand back exactly (only
// integers and lists of them), the interpreter answers instead. tests/map-definitions.test.ts
// holds the two to the same answers.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { compileTyped, fromJs, type MathJSON, toJs } from "@enumeratio/engine/compiled";

export { compileTyped, freshen, fromJs, toJs } from "@enumeratio/engine/compiled";

type Compiled = NonNullable<ReturnType<typeof compileTyped>>;

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
