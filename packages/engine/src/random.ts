// One `Random` (design/random.md): compute-engine's own head, drawing from one seeded stream
// per engine, over whatever can be sampled. A finite collection samples itself -- a uniform
// index, then `at` -- and so does an interval; any other type says how by registering a
// sampler (a distribution, in statistics). The Wolfram spellings (`RandomInteger`,
// `RandomVariate`, …) rewrite to `Random` over the right domain.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "./index.ts";

const DEFAULT_SEED = 42;

/** mulberry32: small, fast, and the same sequence wherever it runs. Not Wolfram's
 *  generator, so only a distribution's shape matches Wolfram's, never the numbers. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const streams = new WeakMap<ComputeEngine, () => number>();

/** Restart this engine's stream; `SeedRandom(n)`. An engine that never seeds starts at 42. */
export function seedRandom(ce: ComputeEngine, seed: number = DEFAULT_SEED): void {
  streams.set(ce, mulberry32(seed));
}

/** The next draw in [0, 1) from this engine's stream. */
export function uniform01(ce: ComputeEngine): number {
  let next = streams.get(ce);
  if (next === undefined) {
    next = mulberry32(DEFAULT_SEED);
    streams.set(ce, next);
  }
  return next();
}

/** One draw from `domain`, or undefined when this sampler doesn't know the domain. */
export type Sampler = (domain: BoxedExpression, ce: ComputeEngine) => BoxedExpression | undefined;

const samplers = new WeakMap<ComputeEngine, Sampler[]>();

/** Teach `Random` a domain it can't sample on its own. */
export function registerSampler(ce: ComputeEngine, sampler: Sampler): void {
  ensureRandom(ce);
  samplers.get(ce)!.push(sampler);
}

interface Collection {
  readonly isFiniteCollection?: boolean;
  readonly count?: number;
  at?(index: number): BoxedExpression | undefined;
}

/** A finite collection with a count we can index uniformly. Past the safe-integer range the
 *  engine gives no count, so `Random` declines rather than draw non-uniformly. */
const collectionSampler: Sampler = (domain, ce) => {
  const c = domain as unknown as Collection;
  if (c.isFiniteCollection !== true || c.count === undefined || c.count < 1 || c.at === undefined) return undefined;
  if (!Number.isSafeInteger(c.count)) return undefined;
  return c.at(1 + Math.floor(uniform01(ce) * c.count));
};

/** `Interval(a, b)` of reals: uniform on it. */
const intervalSampler: Sampler = (domain, ce) => {
  if (domain.operator !== "Interval") return undefined;
  const [lo, hi] = operandsOf(domain).map((op) => (op.operator === "Open" ? operandsOf(op)[0] : op));
  const a = lo?.re;
  const b = hi?.re;
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return ce.number(a + (b - a) * uniform01(ce));
};

const operatorOf = (ce: ComputeEngine, name: string) => {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator : undefined;
};

/** One draw from `domain` by whichever sampler knows it. */
export function sample(ce: ComputeEngine, domain: BoxedExpression): BoxedExpression | undefined {
  for (const sampler of samplers.get(ce) ?? []) {
    const drawn = sampler(domain, ce);
    if (drawn !== undefined) return drawn;
  }
  return undefined;
}

/** `Random`'s signature, arm by arm; a package adds its own domains with `addRandomArm`. */
const ARMS = [
  "(() random -> real)",
  "((collection<any> | set<real>) random -> any)",
  "((collection<any> | set<real>, integer<0..> | list<integer<0..>>) random -> list)",
];

/** Add an overload to `Random` for a domain a package owns, e.g. `(distribution) random -> real`. */
export function addRandomArm(ce: ComputeEngine, arm: string): void {
  ensureRandom(ce);
  const operator = operatorOf(ce, "Random");
  if (operator === undefined) return;
  const current = `${operator.signature as unknown as string}`;
  (operator as { signature: unknown }).signature = ce.type(`${current} & (${arm})`);
}

/**
 * Make compute-engine's `Random` draw from this engine's seeded stream, over collections,
 * intervals and every registered domain, with an optional count or shape: `Random(d, 5)` is
 * five draws, `Random(d, [2, 3])` a 2×3 array of them. Idempotent.
 */
export function ensureRandom(ce: ComputeEngine): void {
  if (samplers.has(ce)) return;
  samplers.set(ce, [collectionSampler, intervalSampler]);
  const operator = operatorOf(ce, "Random");
  if (operator === undefined) return;
  (operator as { signature: unknown }).signature = ce.type(ARMS.join(" & "));
  operator.evaluate = (ops: readonly BoxedExpression[]) => {
    if (ops.length === 0) return ce.number(uniform01(ce));
    const domain = ops[0];
    const shape = ops[1];
    if (shape === undefined) return sample(ce, domain);
    const dims = shape.operator === "List" ? operandsOf(shape).map((d) => d.re) : [shape.re];
    if (dims.some((d) => !Number.isSafeInteger(d) || d < 0)) return undefined;
    const build = (at: number): BoxedExpression | undefined => {
      if (at === dims.length) return sample(ce, domain);
      const items: BoxedExpression[] = [];
      for (let i = 0; i < dims[at]; i++) {
        const item = build(at + 1);
        if (item === undefined) return undefined;
        items.push(item);
      }
      return ce.function("List", items);
    };
    return build(0);
  };
}
