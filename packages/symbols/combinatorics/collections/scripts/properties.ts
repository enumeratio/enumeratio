// The properties Plausible checks at a sampled address (design/plausible.md §4.1). Which ones
// apply is decided by what the family declares; the sampling, shrinking and supervision live in
// sampleable.ts, run-family.ts and plausible.ts.
//
//   1. round trip     rank(unrank(p, r), p) === r — or, for a declared repeating sequence,
//                     unrank(rank(x)) = x with rank(x) ≤ r
//   2. validity       valid(unrank(p, r), p)               — membership of its own element
//   3. injectivity    distinct ranks give distinct elements, over a sampled window
//   4. count          the count agrees with an actual enumeration, on small parameters
//
// NOT a property: what `unrank` does past the end. `FamilyKernel.unrank` returns `Element`,
// not `Element | undefined` — range-checking is the adapter's job in declare.ts, and the
// kernels never promised to decline.

import { randomBelow } from "@enumeratio/plausible";
import type { FamilyKernel } from "../src/families/types.ts";

export { needsBigint } from "./sampleable.ts";
export { random, randomBelow, streamFor } from "@enumeratio/plausible";
/** Counts past this are sampled but never enumerated — property 5 would not finish. */
const ENUMERATE_CAP = 2_000n;

export interface Failure {
  readonly family: string;
  readonly property: string;
  readonly params: number[];
  /** -1n when the failure is about the family rather than one point. */
  readonly rank: bigint;
  readonly detail: string;
}

// JSON.stringify has no bigint support at all -- it throws rather than coerces, unlike its
// NaN -> null silent lossy conversion (which is what let NarcissisticNumbers' large terms,
// back when unrank answered NaN for them, collide under this very key() and misreport as an
// injectivity failure; see issue #90). The replacer tags a bigint as a distinguishable string
// so families with exact large-integer elements (NarcissisticNumbers, FactorialNumbers, …)
// get checked instead of crashing the sampler.
const key = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v.toString()}n` : v));

/** Every property, at one sampled point. Returns the first that fails. */
export function check(entry: FamilyKernel, params: number[], rank: bigint): Failure | undefined {
  const fail = (property: string, detail: string): Failure => ({
    family: entry.head,
    property,
    params,
    rank,
    detail,
  });

  let element: unknown;
  try {
    element = entry.unrank(params, rank);
  } catch (error) {
    return fail("unrank", `threw: ${String(error).slice(0, 120)}`);
  }
  if (element === undefined) return fail("unrank", "returned undefined inside the count");

  // 1. round trip — the one property every family must satisfy.
  let back: bigint;
  try {
    back = entry.rank(element, params);
  } catch (error) {
    return fail("round-trip", `rank threw on its own element: ${String(error).slice(0, 120)}`);
  }
  if (entry.declared?.repeats) {
    // A repeating sequence: rank finds the first occurrence, at or before this one.
    if (back < 0n || back > rank) return fail("round-trip", `rank(unrank(${rank})) = ${back}`);
    if (back !== rank && key(entry.unrank(params, back)) !== key(element)) {
      return fail("round-trip", `unrank(rank(unrank(${rank}))) ≠ unrank(${rank})`);
    }
  } else if (back !== rank) return fail("round-trip", `rank(unrank(${rank})) = ${back}`);

  // 2. validity — a family's own element must be a member. This is the property that keeps
  // finding bugs on the enumeratio side, almost always at a degenerate parameter.
  try {
    if (!entry.valid(element, params)) {
      return fail("validity", `valid() rejected its own element ${key(element)}`);
    }
  } catch (error) {
    return fail("validity", `valid threw: ${String(error).slice(0, 120)}`);
  }

  return undefined;
}

/** Bounds and injectivity, which are about the family rather than one point. */
export function checkFamily(entry: FamilyKernel, params: number[], draw: () => number): Failure | undefined {
  const total = entry.count(params);
  const fail = (property: string, detail: string): Failure => ({
    family: entry.head,
    property,
    params,
    rank: -1n,
    detail,
  });
  if (typeof total !== "bigint" || total < 0n) return fail("count", `count = ${total}`);

  if (entry.declared?.repeats) return undefined; // a sequence, not a set: no injectivity, no distinct count

  // 3. injectivity, over a sampled window rather than the whole family.
  const window = total < 64n ? total : 64n;
  const seen = new Map<string, bigint>();
  for (let i = 0n; i < window; i++) {
    const rank = window === total ? i : randomBelow(draw, total);
    let element: unknown;
    try {
      element = entry.unrank(params, rank);
    } catch {
      continue;
    }
    const shape = key(element);
    const previous = seen.get(shape);
    if (previous !== undefined && previous !== rank) {
      return fail("injectivity", `ranks ${previous} and ${rank} both give ${shape.slice(0, 80)}`);
    }
    seen.set(shape, rank);
  }

  // 4. count — a BACKSTOP, not the first line of defence. On a family small enough for the
  // injectivity window to cover entirely, a wrong count shows up as a duplicate first; this
  // only gets there first when the family is too large for that window but still cheap to
  // enumerate.
  if (total > 0n && total <= ENUMERATE_CAP) {
    const all = new Set<string>();
    for (let r = 0n; r < total; r++) {
      try {
        all.add(key(entry.unrank(params, r)));
      } catch {
        return fail("count", `unrank threw at ${r} of ${total}`);
      }
    }
    if (BigInt(all.size) !== total) {
      return fail("count", `count says ${total}, enumeration gives ${all.size} distinct`);
    }
  }
  return undefined;
}
