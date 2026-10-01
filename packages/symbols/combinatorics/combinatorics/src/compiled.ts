// A map's Epsil definition, compiled to JavaScript by compute-engine's own compiler, and
// memoized by value. The Epsil is the definition; this is only how it runs fast. The compiled
// form comes from compiled-maps.generated.js (written ahead of time by scripts/compile-maps.ts)
// while its hash matches the definition, else from compiling on first use. When the compiler
// can't take a definition yet, or a result isn't one it can hand back exactly (only integers and
// lists of them), the interpreter answers instead. tests/compiled-maps.test.ts holds the two to
// the same answers.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import {
  compileTyped,
  definitionHash,
  inlineCalls,
  fromJs,
  type GeneratedRun,
  isCacheableDefinition,
  type MathJSON,
  pureResult,
  runtimeHelpers,
  toJs,
} from "@enumeratio/engine/compiled";
import { operationEpsil } from "@enumeratio/structures";

export { compileTyped, freshen, fromJs, toJs } from "@enumeratio/engine/compiled";

type Compiled = Pick<NonNullable<ReturnType<typeof compileTyped>>, "run">;

/** A map's definition compiled ahead of time, with the hash of the definition it came from. */
export interface GeneratedMap {
  readonly hash: string;
  readonly run?: GeneratedRun;
  readonly guard?: GeneratedRun;
  /** Its compiled code disagreed with the interpreter when generated: never compiled. */
  readonly interpreted?: true;
}

/** One map's definition as a function of its argument's contents: compiled where it compiles,
 *  interpreted otherwise. A pure definition's answers are cached across engines (`pureResult`);
 *  `cache: false` computes afresh, as a test comparing the two paths must. `undefined` declines
 *  (the guard failed). */
export function fastDefinition(options: {
  ce: ComputeEngine;
  body: unknown;
  guard?: unknown;
  from?: string;
  to?: string;
  interpret: (contents: unknown) => unknown;
  cache?: boolean;
  generated?: GeneratedMap;
}): (contents: unknown) => MathJSON | undefined {
  const { ce, body, guard, from, to, interpret, cache = true, generated } = options;
  const hash = definitionHash({ body, guard });
  let compiled: { body: Compiled; guard?: Compiled } | null | undefined;
  const compile = (): { body: Compiled; guard?: Compiled } | null => {
    if (generated !== undefined && generated.hash === hash) {
      if (generated.interpreted === true || generated.run === undefined) return null;
      const sys = runtimeHelpers(ce);
      const run = generated.run;
      const check = generated.guard;
      return {
        body: { run: (vars) => run(sys, vars) },
        ...(check === undefined ? {} : { guard: { run: (vars) => check(sys, vars) } }),
      };
    }
    if (from === undefined || to === undefined) return null;
    // Calls to our other definitions are expanded, so the compiler sees them too.
    const expand = (expression: unknown): unknown =>
      inlineCalls(expression, (carrier, head) => operationEpsil(ce, carrier, head));
    const main = compileTyped(ce, expand(body), { _raw: from });
    if (main === undefined) return null;
    if (guard === undefined) return { body: main };
    const check = compileTyped(ce, expand(guard), { _raw: from, _image: to });
    return check === undefined ? null : { body: main, guard: check };
  };
  const evaluate = (contents: unknown): MathJSON | undefined => {
    compiled ??= compile();
    const raw = compiled === null ? undefined : toJs(contents);
    if (compiled !== null && raw !== undefined) {
      try {
        const image = compiled.body.run({ _raw: raw });
        const json = fromJs(image);
        if (json !== undefined)
          return compiled.guard !== undefined && compiled.guard.run({ _raw: raw, _image: image }) !== true
            ? undefined
            : json;
      } catch {
        // The interpreter answers below.
      }
    }
    return interpret(contents) as MathJSON | undefined;
  };
  let pure: boolean | undefined;
  return (contents) => {
    pure ??=
      cache &&
      from !== undefined &&
      isCacheableDefinition(ce, body, { _raw: from }) &&
      (guard === undefined || (to !== undefined && isCacheableDefinition(ce, guard, { _raw: from, _image: to })));
    return pure ? pureResult(hash, contents, () => evaluate(contents)) : evaluate(contents);
  };
}
