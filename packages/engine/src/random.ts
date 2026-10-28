// One `Random` (https://github.com/enumeratio/enumeratio/wiki/Random): compute-engine's own head, drawing from one seeded stream
// per engine, over whatever can be sampled. A finite collection samples itself -- a uniform
// index, then `at` -- and so does an interval; any other type says how by registering a
// sampler (a distribution, in statistics). The Wolfram spellings (`RandomInteger`,
// `RandomVariate`, …) rewrite to `Random` over the right domain.

import type { Expression, ComputeEngine } from "@cortex-js/compute-engine";
import { declareCompile } from "./extend.ts";
import { operandsOf } from "./index.ts";
import { defineMessages, emit } from "./messages.ts";

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

/** The next draw in [0, 1) -- from the enclosing `WithRandomSeed` frame when there is one
 *  (compute-engine's counter-based stream, so a seed reproduces its draws), else from this
 *  engine's stream. */
export function uniform01(ce: ComputeEngine): number {
  if (ce._randomFrame !== undefined) return ce._random();
  let next = streams.get(ce);
  if (next === undefined) {
    next = mulberry32(DEFAULT_SEED);
    streams.set(ce, next);
  }
  return next();
}

/** One draw from `domain`, or undefined when this sampler doesn't know the domain. */
export type Sampler = (domain: Expression, ce: ComputeEngine) => Expression | undefined;

const samplers = new WeakMap<ComputeEngine, Sampler[]>();

/** Teach `Random` a domain it can't sample on its own. */
export function registerSampler(ce: ComputeEngine, sampler: Sampler): void {
  ensureRandom(ce);
  samplers.get(ce)!.push(sampler);
}

interface Collection {
  readonly isFiniteCollection?: boolean;
  readonly isEnumerable?: boolean;
  readonly isCollection?: boolean;
  readonly count?: number;
  at?(index: number): Expression | undefined;
}

/** Uniform in [0, n) for any bigint n: 32-bit chunks from the seeded stream, rejecting the
 *  top sliver so every residue is equally likely (a plain modulo would not be). */
export function randomBelow(ce: ComputeEngine, n: bigint): bigint {
  if (n <= 1n) return 0n;
  const chunks = Math.ceil(n.toString(2).length / 32);
  const span = 1n << BigInt(chunks * 32);
  const limit = span - (span % n);
  for (;;) {
    let r = 0n;
    for (let i = 0; i < chunks; i++) r = (r << 32n) | BigInt(Math.floor(uniform01(ce) * 4294967296));
    if (r < limit) return r % n;
  }
}

/** The exact count past 2^53, which compute-engine's number-only `count` can't carry:
 *  `Count` answers it as an integer where the family has a bigint kernel. */
const bigCount = (domain: Expression, ce: ComputeEngine): bigint | undefined => {
  const counted = ce.box(["Count", domain.json] as never).evaluate();
  const number = counted as unknown as {
    isNumberLiteral?: boolean;
    bignumRe?: { isInteger(): boolean; toFixed(): string };
  };
  if (number.isNumberLiteral !== true) return undefined;
  const big = number.bignumRe;
  if (big !== undefined) return big.isInteger() ? BigInt(big.toFixed()) : undefined;
  return Number.isSafeInteger(counted.re) ? BigInt(counted.re) : undefined;
};

type DigitsAt = (c: Expression, index: string) => Expression | undefined;

/** A finite collection past 2^53 elements: a uniform bigint rank, unranked by the family's own
 *  `at` (which takes the ordinal as digits). No bigint count or unrank means no draw at all. */
const hugeSampler = (domain: Expression, ce: ComputeEngine): Expression | undefined => {
  const def = ce.lookupDefinition(domain.operator);
  const at =
    def && "operator" in def
      ? ((def.operator as { collection?: { at?: unknown } } | undefined)?.collection?.at as DigitsAt | undefined)
      : undefined;
  // A family that declines enumeration also declines `Count` into a walk of its elements.
  const total =
    at === undefined || (domain as unknown as Collection).isEnumerable === false ? undefined : bigCount(domain, ce);
  if (at === undefined || total === undefined || total <= BigInt(Number.MAX_SAFE_INTEGER)) {
    emit(ce, "Random", "unrank", [domain]);
    return undefined;
  }
  // An element the family can't produce at a counted rank is its own decline, not a size problem.
  const drawn = at(domain, (randomBelow(ce, total) + 1n).toString());
  if (drawn === undefined || drawn.operator === "Error" || drawn.json === "Missing") return undefined;
  return drawn;
};

/** A finite collection we can index uniformly: by a double rank while the count is a safe
 *  integer, by a bigint rank past it, and otherwise no draw at all (never a non-uniform one). */
const collectionSampler: Sampler = (domain, ce) => {
  const c = domain as unknown as Collection;
  if (c.isFiniteCollection !== true) return undefined;
  if (c.count !== undefined && Number.isSafeInteger(c.count)) {
    if (c.count < 1 || c.at === undefined) return undefined;
    return c.at(1 + Math.floor(uniform01(ce) * c.count));
  }
  return hugeSampler(domain, ce);
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
export function sample(ce: ComputeEngine, domain: Expression): Expression | undefined {
  for (const sampler of samplers.get(ce) ?? []) {
    const drawn = sampler(domain, ce);
    if (drawn !== undefined) return drawn;
  }
  explainDecline(ce, domain);
  return undefined;
}

/** Why `Random` left a collection unevaluated (a huge one says so in `hugeSampler`). */
function explainDecline(ce: ComputeEngine, domain: Expression): void {
  const c = domain as unknown as Collection;
  if (c.isCollection !== true) return;
  if (c.isFiniteCollection === false) emit(ce, "Random", "infinite", [domain]);
  else if (c.isFiniteCollection === true && c.count !== undefined && c.count < 1) emit(ce, "Random", "empty", [domain]);
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
  defineMessages(ce, "Random", {
    infinite: "Cannot draw uniformly from the infinite collection `1`.",
    empty: "Cannot draw from the empty collection `1`.",
    unrank: "`1` is too large to count or to address element by element, so no uniform draw is possible.",
  });
  const operator = operatorOf(ce, "Random");
  if (operator === undefined) return;
  (operator as { signature: unknown }).signature = ce.type(ARMS.join(" & "));
  operator.evaluate = (ops: readonly Expression[]) => {
    if (ops.length === 0) return ce.number(uniform01(ce));
    const domain = ops[0];
    const shape = ops[1];
    if (shape === undefined) return sample(ce, domain);
    const dims = shape.operator === "List" ? operandsOf(shape).map((d) => d.re) : [shape.re];
    if (dims.some((d) => !Number.isSafeInteger(d) || d < 0)) return undefined;
    const build = (at: number): Expression | undefined => {
      if (at === dims.length) return sample(ce, domain);
      const items: Expression[] = [];
      for (let i = 0; i < dims[at]; i++) {
        const item = build(at + 1);
        if (item === undefined) return undefined;
        items.push(item);
      }
      return ce.function("List", items);
    };
    return build(0);
  };
  // compile builtin: compiled code draws from the same seeded stream (tests/random-seed.test.ts)
  declareCompile(ce, "Random", "builtin");
}
