// A map's Epsil definition, compiled to JavaScript by compute-engine's own compiler, and
// memoized by value. The Epsil is the definition; this is only how it runs fast. The compiled
// form comes from compiled-maps.generated.js (written ahead of time by scripts/compile-maps.ts)
// while its hash matches the definition, else from compiling on first use. When the compiler
// can't take a definition yet, or a result isn't one it can hand back exactly (only integers and
// lists of them), the interpreter answers instead. tests/compiled-maps.test.ts holds the two to
// the same answers.

import type { Engine } from "@enumeratio/engine";
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

/** The parts of a map that its composition is resolved and hashed by. */
export interface StepMap {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly body?: unknown;
  readonly guard?: unknown;
  readonly composedOf?: readonly string[];
}

/** The key a map is compiled under. */
export const mapKey = (map: Pick<StepMap, "name" | "from">): string => `${map.name}@${map.from}`;

/**
 * The maps a composition applies, in order of application: each step of `composedOf`, right to left, is
 * the map of that name on the carrier the step before delivers, and a composed step is replaced by its
 * own steps. `undefined` when a step has no such map or no body, or the chain doesn't end at `to`.
 */
export function compositionSteps<M extends StepMap>(
  maps: readonly M[],
  map: M,
  seen: readonly M[] = [],
): M[] | undefined {
  if (map.composedOf === undefined || seen.includes(map)) return undefined;
  const out: M[] = [];
  let carrier = map.from;
  for (const name of map.composedOf.toReversed()) {
    const step = maps.find((m) => m.name === name && m.from === carrier);
    if (step === undefined) return undefined;
    const inner =
      step.composedOf !== undefined
        ? compositionSteps(maps, step, [...seen, map])
        : step.body === undefined
          ? undefined
          : [step];
    if (inner === undefined) return undefined;
    out.push(...inner);
    carrier = step.to;
  }
  return carrier === map.to ? out : undefined;
}

/** A composition's hash: its steps' definitions, so a change to any step voids what was compiled. */
export const compositionHash = (steps: readonly StepMap[]): string =>
  definitionHash(steps.map((step) => [mapKey(step), step.to, definitionHash({ body: step.body, guard: step.guard })]));

/** A composition's generated chain as a function of its argument's contents, or `undefined` while the
 *  chain has no compiled form for these steps (none generated, a step interpreted, or a step edited
 *  since). `undefined` from the function declines to the steps themselves. */
export function composedDefinition(options: {
  ce: Engine;
  steps: readonly StepMap[] | undefined;
  generated?: GeneratedMap;
}): ((contents: unknown) => MathJSON | undefined) | undefined {
  const { ce, steps, generated } = options;
  if (steps === undefined || generated?.run === undefined || generated.hash !== compositionHash(steps))
    return undefined;
  const run = generated.run;
  let sys: unknown;
  return (contents) => {
    const raw = toJs(contents);
    if (raw === undefined) return undefined;
    try {
      sys ??= runtimeHelpers(ce);
      return fromJs(run(sys, { _raw: raw }));
    } catch {
      return undefined;
    }
  };
}

/** One map's definition as a function of its argument's contents: compiled where it compiles,
 *  interpreted otherwise. A pure definition's answers are cached across engines (`pureResult`);
 *  `cache: false` computes afresh, as a test comparing the two paths must. `undefined` declines
 *  (the guard failed). */
export function fastDefinition(options: {
  ce: Engine;
  body: unknown;
  guard?: unknown;
  from?: string;
  to?: string;
  interpret: (contents: unknown) => unknown;
  cache?: boolean;
  generated?: GeneratedMap;
  /** A verified fast path over the plain-JS contents, tried before compiling; `undefined` declines. */
  kernel?: (raw: never) => unknown;
}): (contents: unknown) => MathJSON | undefined {
  const { ce, body, guard, from, to, interpret, cache = true, generated, kernel } = options;
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
    if (kernel !== undefined) {
      const input = toJs(contents);
      const image = input === undefined ? undefined : fromJs(kernel(input as never));
      if (image !== undefined) return image;
    }
    if (compiled === undefined) compiled = compile();
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
    // A kernel is quick enough that caching its answers costs more than computing them.
    pure ??=
      cache &&
      kernel === undefined &&
      from !== undefined &&
      isCacheableDefinition(ce, body, { _raw: from }) &&
      (guard === undefined || (to !== undefined && isCacheableDefinition(ce, guard, { _raw: from, _image: to })));
    return pure ? pureResult(hash, contents, () => evaluate(contents)) : evaluate(contents);
  };
}
