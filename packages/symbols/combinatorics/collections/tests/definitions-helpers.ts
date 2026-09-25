// Shared setup for the definitions.test.ts shards (definitions-*.test.ts): the engine, the
// reference-vs-implementation differential, and the permutation generator each shard's loop
// runs over.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareStats } from "../src/stats.ts";
import { DEFINITIONS, PRIMITIVE } from "../src/definitions.ts";

export { DEFINITIONS, PRIMITIVE };

export const ce = new ComputeEngine();
declareStats(ce);

/** Every permutation of 1..n, as MathJSON lists. */
export function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}

export const evaluate = (expr: unknown, p: number[]): number =>
  ce
    .box(expr as Parameters<ComputeEngine["box"]>[0])
    .subs({ _p: ce.box(["List", ...p]) })
    .evaluate().re;
