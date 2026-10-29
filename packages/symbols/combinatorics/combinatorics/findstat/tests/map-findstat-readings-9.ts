// Readings for maps batch 9: Stump's noncrossing permutation (Mp00023), the Adin-Bagno-Roichman bijection
// (Mp00124), Ringel's permutation of a Nakayama algebra (Mp00201) and a parking function's support Dyck path
// (Mp00056), after the Sage code FindStat states for each. Same contract as map-findstat-readings.ts:
// FindStat's text in, FindStat's text out.

import type { Reading } from "./map-findstat-readings.ts";

const ints = (text: string): number[] => JSON.parse(text) as number[];
const list = (items: readonly number[]): string => `[${items.join(",")}]`;
const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);

/** Each up step's height before it (the area sequence). */
const areaSequence = (word: readonly number[]): number[] => {
  const out: number[] = [];
  let height = 0;
  for (const step of word) {
    if (step === 1) out.push(height);
    height += step === 1 ? 1 : -1;
  }
  return out;
};

// --- Mp00023: Sage's `pealing` and `to_noncrossing_permutation` ---

const pealing = (area: readonly number[]): { area: number[]; touchSequences: number[][] } => {
  const n = area.length;
  const next: number[] = [];
  const touchSequences: number[][] = [];
  let touches: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (area[i + 1] === 0) {
      touches.push(i + 1);
      if (touches.length > 1) {
        touchSequences.push(touches);
        touches = [];
      } else if (area[i] === 0) touches = [];
      next.push(0);
    } else if (area[i + 1] === 1) {
      next.push(0);
      touches.push(i + 1);
    } else next.push(area[i + 1]! - 2);
  }
  next.push(0);
  if (area[n - 1]) {
    touches.push(n);
    if (touches.length > 1) touchSequences.push(touches);
  }
  return { area: next, touchSequences };
};

const noncrossingPermutation = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  if (n === 0) return [];
  const pi = range(1, n);
  let peeled = pealing(areaSequence(word));
  while (peeled.touchSequences.length > 0) {
    for (const touches of peeled.touchSequences) {
      const first = pi[touches[0]! - 1]!;
      for (let i = 0; i < touches.length - 1; i++) pi[touches[i]! - 1] = pi[touches[i + 1]! - 1]!;
      pi[touches.at(-1)! - 1] = first;
    }
    peeled = pealing(peeled.area);
  }
  return pi;
};

// --- Mp00124: the Adin-Bagno-Roichman transformation, Sage's recursion on 321-avoiding permutations ---

/** The word with its values `a` and `b` exchanged. */
const exchanged = (word: readonly number[], a: number, b: number): number[] =>
  word.map((v) => (v === a ? b : v === b ? a : v));

const adinBagnoRoichman = (pi: readonly number[]): number[] => {
  const n = pi.length;
  if (n <= 1) return [...pi];
  const k = range(0, n - 1).filter((i) => pi.slice(0, i + 1).every((v) => v <= i + 1)).length;
  if (pi.at(-1) === n) return [...adinBagnoRoichman(pi.slice(0, -1)), n];
  const at = pi.indexOf(n);
  if (at > pi.indexOf(n - 1)) {
    const rest = adinBagnoRoichman(pi.filter((_, i) => i !== at));
    rest.splice(at, 0, n);
    return exchanged(rest, n - k - 1, n - k);
  }
  return adinBagnoRoichman(exchanged(pi, n - 1, n)).map((v) => (v >= n - k ? (v === n ? n - k : v + 1) : v));
};

/** Sage's `to_321_avoiding_Krattenthaler`, from the rise composition and the reversed one. */
const toKrattenthaler = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  const rises = (steps: readonly number[]): number[] => {
    const out: number[] = [];
    let run = 0;
    for (const step of steps) {
      if (step === 1) run++;
      else if (run > 0) {
        out.push(run);
        run = 0;
      }
    }
    return out;
  };
  const a = rises(word);
  const A = a.map((_, i) => a.slice(0, i + 1).reduce((x, y) => x + y, 0));
  const d = rises(word.toReversed().map((step) => 1 - step)).toReversed();
  const D = a.map((_, i) => d.slice(0, i).reduce((x, y) => x + y, 0));
  const pi: (number | undefined)[] = Array<number | undefined>(n).fill(undefined);
  const rest = range(1, n);
  A.forEach((e, i) => {
    pi[D[i]!] = e;
    rest.splice(rest.indexOf(e), 1);
  });
  let i = 0;
  for (const e of rest) {
    while (pi[i] !== undefined) i++;
    pi[i] = e;
  }
  return pi as number[];
};

const leftToRightMaximaToDyck = (pi: readonly number[]): number[] => {
  const l: [number, number][] = [[0, 0]];
  pi.forEach((e, i) => {
    if (e > l.at(-1)![1]) l.push([i, e]);
  });
  l.push([pi.length, pi.length]);
  const out: number[] = [];
  for (let i = 0; i < l.length - 2; i++)
    out.push(...Array<number>(l[i + 1]![1] - l[i]![1]).fill(1), ...Array<number>(l[i + 2]![0] - l[i + 1]![0]).fill(0));
  return out;
};

// --- Mp00201: Ringel's permutation, Sage's matrix walk ---

const ringel = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  const matrix = Array.from({ length: n + 1 }, () => Array<number>(n + 1).fill(0));
  matrix[0]![0] = 1;
  let i = 0;
  let j = 0;
  for (const step of word) {
    if (step === 1) i++;
    else j++;
    matrix[j]![i] = 1;
  }
  const columns = n + 1;
  const toProjective = (r: number, c: number): number => {
    while (c < columns && matrix[r]![c] !== 1) c++;
    while (c < columns && matrix[r]![c] !== 0) c++;
    return c - 1;
  };
  const toInjective = (r: number, c: number): number => {
    while (r >= 0 && matrix[r]![c] !== 1) r--;
    while (r >= 0 && matrix[r]![c] !== 0) r--;
    return r + 1;
  };
  const isProjective = (r: number, c: number): boolean =>
    matrix[r]![c] === 1 && (c + 1 === columns || matrix[r]![c + 1] === 0);
  const omega = ([r, c]: [number, number]): [number, number] => [c + 1, toProjective(r, c)];
  return range(0, n).map((start) => {
    let simple: [number, number] = [start, start];
    let injective: [number, number] = [toInjective(start, start), start];
    for (;;) {
      if (isProjective(...injective)) return injective[0] + 1;
      injective = omega(omega(injective));
      simple = omega(simple);
      if (isProjective(...simple)) return simple[0] + 1;
      simple = omega(simple);
    }
  });
};

export const BATCH_NINE_READINGS: Readonly<Record<string, Reading>> = {
  "NoncrossingPermutation@DyckPath": (d) => list(noncrossingPermutation(ints(d))),
  "AdinBagnoRoichman@DyckPath": (d) => list(leftToRightMaximaToDyck(adinBagnoRoichman(toKrattenthaler(ints(d))))),
  "Ringel@DyckPath": (d) => list(ringel(ints(d))),
  // The area sequence of the sorted entries, as the path's up steps.
  "SupportDyckPath@ParkingFunction": (p) => {
    const sorted = ints(p).toSorted((a, b) => a - b);
    const ups = new Set(sorted.map((v, i) => v + i));
    return list(range(1, 2 * sorted.length).map((position) => (ups.has(position) ? 1 : 0)));
  },
};
