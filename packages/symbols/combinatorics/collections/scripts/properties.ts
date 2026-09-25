// Property-based sampling over the collection catalogue — a port of enumeratio's
// `quickcheck.mts`, which the notatio side makes considerably easier.
//
// There, every property costs a pglite round trip, so the harness needs a worker channel, a
// SIGKILL watchdog and a per-collection budget. Here a `FamilyKernel` is a pure kernel over
// plain JS values — count, unrank, rank, valid, with no engine anywhere near it — so the
// sampling is a plain loop and the whole catalogue runs in under a second. What ports is
// the IDEA: draw random points and check properties that must hold at EVERY point, rather
// than the first N that an example suite happens to pin.
//
// THE PROPERTIES (skipped, never failed, when a family cannot answer):
//   1. round trip     rank(unrank(p, r), p) === r          — the universal one
//   2. validity       valid(unrank(p, r), p)               — membership of its own element
//   3. injectivity    distinct ranks give distinct elements, over a sampled window
//   4. count          the count agrees with an actual enumeration, on small parameters
//
// NOT a property: what `unrank` does past the end. `FamilyKernel.unrank` returns `Element`,
// not `Element | undefined` — range-checking is the adapter's job in library.ts, and the
// kernels never promised to decline. Asserting it anyway reported all 41 families as
// failing on the first run, which is the harness being wrong rather than the catalogue.
//
// THE SHRINKER: on a failure, walk the rank down toward 0 and then the parameters down
// toward their minimum, reporting the smallest point that still fails. Best-effort, not
// exhaustive — the aim is a repro small enough to read.
//
// SEEDING: mulberry32, seeded from argv, the environment, or the clock, and PRINTED. Every
// failure prints the exact command that replays it.
//
// Advisory, never a gate: a fresh seed each run means a red result is a finding to triage,
// not a broken build.
//
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts             # everything, fresh seed
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts perm        # families matching "perm"
//   vp node packages/symbols/combinatorics/collections/scripts/quickcheck.ts perm 123456 # replay exactly
//   QUICKCHECK_POINTS=20 vp node …/quickcheck.ts                   # more points per family

import type { FamilyKernel } from "../src/families/types.ts";
/** Counts past this are sampled but never enumerated — property 5 would not finish. */
const ENUMERATE_CAP = 2_000;

/** mulberry32 — tiny, deterministic, and good enough to find bugs. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A stream of its own per family (FNV-1a of `seed/key`), so what one family draws never
 *  depends on which families ran before it — filtering the run to one head replays it. */
export function streamFor(seed: number, key: string): () => number {
  let h = 2166136261;
  for (const ch of `${seed}/${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return random(h >>> 0);
}

export interface Failure {
  readonly family: string;
  readonly property: string;
  readonly params: number[];
  readonly rank: number;
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
export function check(entry: FamilyKernel, params: number[], rank: number): Failure | undefined {
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
  let back: number;
  try {
    back = entry.rank(element, params);
  } catch (error) {
    return fail("round-trip", `rank threw on its own element: ${String(error).slice(0, 120)}`);
  }
  if (back !== rank) return fail("round-trip", `rank(unrank(${rank})) = ${back}`);

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
    rank: -1,
    detail,
  });
  if (!Number.isFinite(total) || total < 0) return fail("count", `count = ${total}`);

  // 3. injectivity, over a sampled window rather than the whole family.
  const window = Math.min(total, 64);
  const seen = new Map<string, number>();
  for (let i = 0; i < window; i++) {
    const rank = window === total ? i : Math.floor(draw() * total);
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
  if (total > 0 && total <= ENUMERATE_CAP) {
    const all = new Set<string>();
    for (let r = 0; r < total; r++) {
      try {
        all.add(key(entry.unrank(params, r)));
      } catch {
        return fail("count", `unrank threw at ${r} of ${total}`);
      }
    }
    if (all.size !== total) {
      return fail("count", `count says ${total}, enumeration gives ${all.size} distinct`);
    }
  }
  return undefined;
}

/** Walk a failure down toward the smallest point that still shows it. */
export function shrink(entry: FamilyKernel, failure: Failure): Failure {
  let best = failure;
  if (failure.rank >= 0) {
    for (let rank = 0; rank < best.rank; rank++) {
      const smaller = check(entry, best.params, rank);
      if (smaller?.property === best.property) {
        best = smaller;
        break;
      }
    }
  }
  for (let index = 0; index < best.params.length; index++) {
    for (let value = 0; value < (best.params[index] as number); value++) {
      const params = [...best.params];
      params[index] = value;
      const total = (() => {
        try {
          return entry.count(params);
        } catch {
          return 0;
        }
      })();
      if (!Number.isFinite(total) || total <= 0) continue;
      const smaller =
        best.rank >= 0 ? check(entry, params, Math.min(best.rank, total - 1)) : checkFamily(entry, params, random(1));
      if (smaller?.property === best.property) {
        best = smaller;
        break;
      }
    }
  }
  return best;
}
