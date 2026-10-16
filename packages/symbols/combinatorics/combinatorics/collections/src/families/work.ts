// What the numeric kernels in plain numbers share to keep a question to about a second of work and a
// bounded amount of memory: past either, they decline (the "not bigint yet" RangeError `needsBigint`
// reads as unknown) rather than hang or fill the heap. A bound is a work estimate in steps of a loop
// (about 5 ns each, measured), not a clock, so the answer never depends on the machine.

import { factorInteger, isPrime as isPrimeBig } from "@enumeratio/residues";

/** The work a single question may take, in the steps `Cost` counts (measured: about 5 ns each, so a second or so). */
export const WORK = 2e8;

/** Refuse a question that is past the work or memory a kernel in plain numbers bounds itself to. */
export const declineWork = (what: string): never => {
  throw new RangeError(`${what}: ${WORK_MESSAGE}; not bigint yet`);
};

const WORK_MESSAGE = "past the work this kernel does";

/** Whether `error` is a `declineWork`: the question is too much for any path, so no other is tried. */
export const isWorkDecline = (error: unknown): boolean =>
  error instanceof RangeError && error.message.includes(WORK_MESSAGE);

/** `value` where a double holds it exactly (a value derived from an element: n + 2, 2n + 1, a reversal),
 *  else a decline: rounded, it would answer for some other integer. */
export const exactly = (what: string, value: number): number =>
  Number.isSafeInteger(value) ? value : declineWork(`${what} ${value} exceeds 2^53`);

/** Below this, trial division beats the bigint routes. */
const TRIAL = 1e6;

/** Whether the integer `n` is prime: trial division while that is a few hundred steps, else Baillie–PSW. */
export function isPrimeNumber(n: number): boolean {
  if (!Number.isSafeInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n > TRIAL) return isPrimeBig(BigInt(n));
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

/** The prime factorisation of the integer `n`, ascending [prime, exponent] pairs (none for anything below
 *  2): trial division while that is a few hundred steps, else residues' (trial division, then Pollard's
 *  rho), which declines if a cofactor resists. Nothing is kept between calls. */
export function factorsOf(n: number): [number, number][] {
  if (!Number.isSafeInteger(n) || n < 2) return [];
  if (n > TRIAL) {
    const factors = factorInteger(BigInt(n));
    if (factors === undefined) return declineWork(`factoring ${n}`);
    return factors.map(([p, e]) => [Number(p), e]);
  }
  let m = n;
  const factors: [number, number][] = [];
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2) {
    if (m % p !== 0) continue;
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    factors.push([p, e]);
  }
  if (m > 1) factors.push([m, 1]);
  return factors;
}

/** σ(n), the sum of the divisors of n ≥ 1, exactly (it passes 2^53 a little before n does). */
export function sigmaOf(n: number): bigint {
  let total = 1n;
  for (const [p, e] of factorsOf(n)) {
    const q = BigInt(p);
    total *= (q ** BigInt(e + 1) - 1n) / (q - 1n);
  }
  return total;
}

/** An entry of a map kept per param, the oldest dropped past `limit` of them. */
export function memoBy<K, V>(entries: Map<K, V>, key: K, make: () => V, limit = 16): V {
  let value = entries.get(key);
  if (value === undefined) {
    value = make();
    entries.set(key, value);
    if (entries.size > limit) entries.delete(entries.keys().next().value!);
  } else {
    entries.delete(key);
    entries.set(key, value);
  }
  return value;
}

/** What testing the integer `n` costs, in steps: a trial division's square root by default. */
export type Cost = (n: number) => number;
const trialCost: Cost = (n) => Math.sqrt(n) + 4;
/** A predicate over the digits or bits of n. */
export const digitCost: Cost = () => 60;

/**
 * The integers from `start` that pass `predicate`, found by one scan upward that every question extends and
 * the next question reads. A question that would take the scan past `WORK` steps (the sum of each integer's
 * `cost`) declines, the scan so far kept: it never runs to a value no machine reaches.
 */
export function matchCache(
  head: string,
  predicate: (n: number) => boolean,
  { start = 1, cost = trialCost }: { start?: number; cost?: Cost } = {},
) {
  const matches: number[] = [];
  let scanned = start - 1;
  const step = (budget: { work: number }): void => {
    scanned++;
    if (predicate(scanned)) matches.push(scanned);
    budget.work += cost(scanned);
    if (budget.work > WORK) declineWork(`${head}: scanning past ${scanned}`);
  };
  return {
    /** The k-th match (1-indexed). */
    nth: (k: number): number => {
      const budget = { work: 0 };
      while (matches.length < k) step(budget);
      return matches[k - 1];
    },
    /** 0-indexed rank of `value`, or -1 if it isn't a match. */
    rankOf: (value: number): number => {
      if (!Number.isInteger(value) || value < start) return -1;
      const budget = { work: 0 };
      while (scanned < value) step(budget);
      return matches.indexOf(value);
    },
  };
}
