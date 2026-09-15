import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type Boxed, intOf } from "./packs/types.ts";

// Permutation statistics over a one-line word (a List of 1..n). Pure functions,
// lifted from the sibling @enumeratio library, declared as compute-engine heads
// that evaluate on a concrete permutation.

const asPerm = (arg: BoxedExpression | undefined): number[] =>
  ((arg as unknown as Boxed | undefined)?.ops ?? []).map(intOf);

/** Pairs (i, j), i < j, with p[i] > p[j]. */
export function inversions(p: number[]): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) c++;
  }
  return c;
}

/** Positions i with p[i] > p[i+1]. */
export function descents(p: number[]): number {
  let c = 0;
  for (let i = 0; i + 1 < p.length; i++) if (p[i] > p[i + 1]) c++;
  return c;
}

/** Positions i with p[i] < p[i+1]. */
export function ascents(p: number[]): number {
  let c = 0;
  for (let i = 0; i + 1 < p.length; i++) if (p[i] < p[i + 1]) c++;
  return c;
}

/** Sum of the (1-based) descent positions. */
export function majorIndex(p: number[]): number {
  let s = 0;
  for (let i = 0; i + 1 < p.length; i++) if (p[i] > p[i + 1]) s += i + 1;
  return s;
}

/** Positions i (1-based) with p[i] = i. */
export function fixedPoints(p: number[]): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) if (p[i] === i + 1) c++;
  return c;
}

/** Number of cycles (orbits) of the permutation. */
export function cycleCount(p: number[]): number {
  const n = p.length;
  const seen: boolean[] = Array.from({ length: n }, () => false);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    c++;
    let j = i;
    do {
      seen[j] = true;
      j = p[j] - 1;
    } while (j !== i);
  }
  return c;
}

/** Positions i (1-based) with p[i] > i. */
export function excedances(p: number[]): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) if (p[i] > i + 1) c++;
  return c;
}

/** Positions i (1-based) with p[i] < i. */
export function antiexcedances(p: number[]): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) if (p[i] < i + 1) c++;
  return c;
}

/** Positions with a value exceeding every value to its left (left-to-right maxima). */
export function records(p: number[]): number {
  let c = 0;
  let max = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > max) {
      c++;
      max = p[i];
    }
  }
  return c;
}

/** Interior positions i with p[i-1] < p[i] > p[i+1]. */
export function peaks(p: number[]): number {
  let c = 0;
  for (let i = 1; i + 1 < p.length; i++) if (p[i - 1] < p[i] && p[i] > p[i + 1]) c++;
  return c;
}

/** Interior positions i with p[i-1] > p[i] < p[i+1]. */
export function valleys(p: number[]): number {
  let c = 0;
  for (let i = 1; i + 1 < p.length; i++) if (p[i - 1] > p[i] && p[i] < p[i + 1]) c++;
  return c;
}

/** Sum of the (1-based) ascent positions (the comajor index). */
export function minorIndex(p: number[]): number {
  let s = 0;
  for (let i = 0; i + 1 < p.length; i++) if (p[i] < p[i + 1]) s += i + 1;
  return s;
}

/**
 * The statistics, split by what they actually read. A `word` statistic compares entries with
 * each OTHER, so the same reading stands on any integer sequence; a `perm` statistic reads a
 * value against its position or walks the orbits, and means nothing without the bijection.
 * The same split as `word` vs `stat` in @enumeratio/statistics, for the heads this package
 * owns instead.
 */
const WORD_STATS: Record<string, (p: number[]) => number> = {
  Inversions: inversions,
  Descents: descents,
  Ascents: ascents,
  MajorIndex: majorIndex,
  MinorIndex: minorIndex,
  Records: records,
  Peaks: peaks,
  Valleys: valleys,
};
const PERM_STATS: Record<string, (p: number[]) => number> = {
  FixedPoints: fixedPoints,
  CycleCount: cycleCount,
  Excedances: excedances,
  Antiexcedances: antiexcedances,
};

export interface StatsOptions {
  /**
   * The minted carrier type for a permutation (`@enumeratio/domains`' `permutation`). Given
   * it, each head takes the CARRIER: `Cycles(Permutation([2,3,1]))` is the question and
   * `Cycles([2,3,1])` is a type error. A word statistic additionally accepts a bare list,
   * because that reading stands on its own.
   *
   * This package cannot import the domains (they depend on it), so the caller supplies the
   * name. Without it every head takes a bare list, as before.
   */
  readonly permutationType?: string;
  /** The constructor head wrapping that type — `Permutation`. */
  readonly permutationCarrier?: string;
}

/** Declare the permutation-statistic heads on `ce` (each maps a permutation to an integer). */
export function declareStats(ce: ComputeEngine, options: StatsOptions = {}): void {
  const { permutationType: type, permutationCarrier: carrier = "Permutation" } = options;
  const declare = (head: string, fn: (p: number[]) => number, alsoOnList: boolean): void => {
    const signature =
      type === undefined
        ? "(list) -> integer"
        : alsoOnList
          ? `(${type} | list) -> integer`
          : `(${type}) -> integer`;
    ce.declare(head, {
      signature,
      evaluate: (args: readonly BoxedExpression[]) => {
        const subject = args[0];
        // Unwrap only an actual carrier; the `alsoOnList` arm of the union lets a bare list
        // through untouched.
        const inner =
          subject?.operator === carrier
            ? ((subject as unknown as Boxed).ops?.[0] as BoxedExpression | undefined)
            : subject;
        return ce.number(fn(asPerm(inner)));
      },
    });
  };
  for (const [head, fn] of Object.entries(WORD_STATS)) declare(head, fn, true);
  for (const [head, fn] of Object.entries(PERM_STATS)) declare(head, fn, false);
}
