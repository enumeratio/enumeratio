// Recurrence-defined numeric sequences as NumberKernel "scalar" entries (element = a single
// integer, a term of the sequence). Same shape as numeric-sets.ts's PrimeNumbers/SquareNumbers/
// AbundantNumbers/SmoothNumbers, but every term here is a bigint: several of these grow past
// Number.MAX_SAFE_INTEGER well within the first 30 terms (BellNumbers, FubiniNumbers,
// PartitionNumbers, ...), and `contains`/`rank` need exact equality, not float comparison.
//
// `At(S, 1)` is the first term (1-based). Each entry documents its own starting term and how
// it lines up with the OEIS offset -- see the reference entries at the end of
// packages/reference/src/entries/enumerable-families.ts for the definitive statement per
// sequence; the comments here are the implementation-level version of the same facts.
import type { EpsilFamily } from "./epsil.ts";
import { withSequenceDefinitions } from "./sequence-definitions.ts";
import { bigAware, type Declared, type NumberKernel } from "./types.ts";
import { declineWork } from "./work.ts";

// ---- shared: bigint decode + a bounded forward scan for membership/rank. ----

/** Boxed elements arrive here as a number or, past 2^53, a bigint (`scalarOf`, types.ts). Either way, decode
 *  once to a bigint so `contains`/`rank` never compare across mixed types. */
function toBigInt(x: unknown): bigint | undefined {
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return Number.isInteger(x) ? BigInt(x) : undefined;
  return undefined;
}

/** The terms a scan for a value reads, and so a recurrence's cache grows to: the most that is a few megabytes
 *  for the fastest growing (a Delannoy number gains about 2.5 bits a term). A value past the last is declined. */
const SCAN_TERMS = 8000;

/** A scan that ran out of terms before settling the value: unknown, never a verdict. */
const declineScan = (head: string, value: bigint): never => {
  throw new RangeError(`${head}: ${value} is past the terms scanned; its kernel is not bigint yet`);
};

/** Scans `nth(0), nth(1), ...` for `value`. Once past `monotoneFrom`, the sequence is assumed
 *  non-decreasing forever (true for every recurrence below past its initial transient), so the
 *  scan can stop the moment a term exceeds the target -- otherwise it just checks equality.
 *  `cap` bounds the terms scanned; a value still ahead of the last one is declined, not absent. */
function scanMembership(head: string, nth: (k: number) => bigint, monotoneFrom = 0, cap = SCAN_TERMS) {
  return {
    contains(value: bigint): boolean {
      if (value < 0n) return false;
      for (let i = 0; i <= cap; i++) {
        const t = nth(i);
        if (t === value) return true;
        if (i >= monotoneFrom && t > value) return false;
      }
      return declineScan(head, value);
    },
    rankOf(value: bigint): number {
      if (value < 0n) return -1;
      for (let i = 0; i <= cap; i++) {
        const t = nth(i);
        if (t === value) return i;
        if (i >= monotoneFrom && t > value) return -1;
      }
      return declineScan(head, value);
    },
  };
}

// ---- two-term linear recurrences (Fibonacci, Lucas, Jacobsthal, Pell, Tribonacci) ----

/** A linear recurrence over a growing bigint cache: `next` computes term `terms.length` from
 *  whatever is already in `terms`. `monotoneFrom` documents where the sequence stops dipping
 *  (e.g. Lucas dips once, 2 -> 1, then climbs forever). */
function recurrenceCache(seed: bigint[], next: (terms: readonly bigint[]) => bigint) {
  const terms = [...seed];
  return {
    nth: (k: number): bigint => {
      while (terms.length <= k) terms.push(next(terms));
      return terms[k];
    },
  };
}

const fibonacci = recurrenceCache([0n, 1n], (t) => t[t.length - 1] + t[t.length - 2]);
const lucas = recurrenceCache([2n, 1n], (t) => t[t.length - 1] + t[t.length - 2]);
const jacobsthal = recurrenceCache([0n, 1n], (t) => t[t.length - 1] + 2n * t[t.length - 2]);
const pell = recurrenceCache([0n, 1n], (t) => 2n * t[t.length - 1] + t[t.length - 2]);
const tribonacci = recurrenceCache([0n, 0n, 1n], (t) => t[t.length - 1] + t[t.length - 2] + t[t.length - 3]);
// Pₙ = Pₙ₋₂ + Pₙ₋₃, base case a(0)=1, a(1)=a(2)=0 (A000931). Dips through index 4 (1,0,0,1,0)
// before climbing forever from index 4 (0,1,1,1,2,2,3,...).
const padovan = recurrenceCache([1n, 0n, 0n], (t) => t[t.length - 2] + t[t.length - 3]);
// Pₙ = Pₙ₋₂ + Pₙ₋₃, base case P(0)=3, P(1)=0, P(2)=2 (A001608). Dips through index 4 too.
const perrin = recurrenceCache([3n, 0n, 2n], (t) => t[t.length - 2] + t[t.length - 3]);

// ---- Catalan: Cₙ = C_{n-1} * 2(2n-1)/(n+1), exact (division is always integral). ----

const catalan = recurrenceCache([1n], (t) => {
  const n = t.length;
  return (t[n - 1] * BigInt(2 * (2 * n - 1))) / BigInt(n + 1);
});

// ---- Motzkin: a(n) = ((2n+1) a(n-1) + 3(n-1) a(n-2)) / (n+2), n >= 2, a(0)=a(1)=1. ----

const motzkin = recurrenceCache([1n, 1n], (t) => {
  const n = t.length; // computing a(n)
  return (BigInt(2 * n + 1) * t[n - 1] + BigInt(3 * (n - 1)) * t[n - 2]) / BigInt(n + 2);
});

// ---- CentralDelannoy: n D(n) = 3(2n-1) D(n-1) - (n-1) D(n-2), D(0)=1, D(1)=3. ----

const centralDelannoy = recurrenceCache([1n, 3n], (t) => {
  const n = t.length; // computing D(n)
  return (3n * BigInt(2 * n - 1) * t[n - 1] - BigInt(n - 1) * t[n - 2]) / BigInt(n);
});

// ---- LittleSchroder: (n+1) s(n) = (6n-3) s(n-1) - (n-2) s(n-2), n >= 2, s(0)=s(1)=1. ----

const littleSchroder = recurrenceCache([1n, 1n], (t) => {
  const n = t.length; // computing s(n)
  return (BigInt(6 * n - 3) * t[n - 1] - BigInt(n - 2) * t[n - 2]) / BigInt(n + 1);
});

/** SchroederNumbers: S(0) = 1, S(n) = 2 * littleSchroder(n) for n >= 1 (the catalog's own
 *  definition) -- reuses the little-Schröder cache rather than re-deriving a recurrence. */
function schroederNth(n: number): bigint {
  return n === 0 ? 1n : 2n * littleSchroder.nth(n);
}

// ---- Bell (Aitken's triangle) and Fubini (needs a bigint Pascal's triangle). ----

/** The most terms Bell and Fubini build: their rows are a quadratic number of bigints (about a second). */
const BELL_MAX = 1500;
const FUBINI_MAX = 500;

// Only the last row of the triangle is kept, and the term each row starts.
const bellTerms: bigint[] = [1n];
let bellRow: bigint[] = [1n];
function bellNth(n: number): bigint {
  if (n > BELL_MAX) return declineWork(`BellNumbers: term ${n}`);
  while (bellTerms.length <= n) {
    const row: bigint[] = [bellRow[bellRow.length - 1]];
    for (let j = 0; j < bellRow.length; j++) row.push(row[j] + bellRow[j]);
    bellRow = row;
    bellTerms.push(row[0]);
  }
  return bellTerms[n];
}

const pascalRows: bigint[][] = [[1n]];
function binomialBig(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  while (pascalRows.length <= n) {
    const prev = pascalRows[pascalRows.length - 1];
    const row: bigint[] = [1n];
    for (let i = 1; i < prev.length; i++) row.push(prev[i - 1] + prev[i]);
    row.push(1n);
    pascalRows.push(row);
  }
  return pascalRows[n][k];
}

const fubiniTerms: bigint[] = [1n];
function fubiniNth(n: number): bigint {
  if (n > FUBINI_MAX) return declineWork(`FubiniNumbers: term ${n}`);
  while (fubiniTerms.length <= n) {
    const m = fubiniTerms.length;
    let sum = 0n;
    for (let k = 1; k <= m; k++) sum += binomialBig(m, k) * fubiniTerms[m - k];
    fubiniTerms.push(sum);
  }
  return fubiniTerms[n];
}

// ---- PartitionNumbers: Euler's pentagonal-number recurrence, bigint (mirrors PartitionsP
// in kernels-combinatorics.ts, but that one is a plain-number kernel -- p(n) itself stays
// small, but every family here is bigint on principle so At never has a float/bigint seam). ----

/** Partition terms take about n^1.5 steps in all; this many is about a second. */
const PARTITION_MAX = 50_000;

const partitionTerms: bigint[] = [1n];
function partitionNth(n: number): bigint {
  if (n > PARTITION_MAX) return declineWork(`PartitionNumbers: term ${n}`);
  while (partitionTerms.length <= n) {
    const m = partitionTerms.length;
    let sum = 0n;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2;
      const g2 = (k * (3 * k + 1)) / 2;
      if (g1 > m && g2 > m) break;
      const sign = k % 2 === 1 ? 1n : -1n;
      if (g1 <= m) sum += sign * partitionTerms[m - g1];
      if (g2 <= m) sum += sign * partitionTerms[m - g2];
    }
    partitionTerms.push(sum);
  }
  return partitionTerms[n];
}

// ---- Stern's diatomic sequence (fusc): s(0)=0, s(1)=1, s(2n)=s(n), s(2n+1)=s(n)+s(n+1).
// O(log n) per term via the bit-doubling pairs (fusc(k), fusc(k+1)), no growing cache needed.
// Every non-negative integer is a term (0 once, at n=0; every positive integer infinitely
// often), so membership is just "is this a non-negative integer" -- no scan required. ----

const fuscCache = new Map<number, bigint>();
function fusc(n: number): bigint {
  if (n === 0) return 0n;
  const cached = fuscCache.get(n);
  if (cached !== undefined) return cached;
  if (fuscCache.size >= 100_000) fuscCache.clear();
  let a = 0n;
  let b = 1n;
  for (const bit of n.toString(2)) {
    if (bit === "0") b = a + b;
    else a = a + b;
  }
  fuscCache.set(n, a);
  return a;
}

// ---- Thue-Morse: t(n) = popcount(n) mod 2. Values are only ever 0 or 1. ----

function thueMorse(n: number): bigint {
  let bits = n;
  let parity = 0;
  while (bits > 0) {
    parity ^= bits % 2;
    bits = Math.floor(bits / 2);
  }
  return BigInt(parity);
}

// ---- NumberKernel entries. `unrank` returns a bigint cast through Element's `number` slot
// (types.ts is out of bounds for this task; declare.ts's `element()` already casts the
// unrank result `as never` before boxing, so the runtime bigint reaches `ce.box` untouched). ----

/** A recurrence sequence: terms by index, rank by scanning the terms up to the value. */
const sequence = (repeats: boolean): Declared => ({
  carrier: "Numeric",
  params: [],
  cost: { count: "closed", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
  repeats,
});

/** Only small terms repeat (Fibonacci's 1, 1; Padovan's 2, 2): these sequences grow once past
 *  `monotoneFrom`, so a short prefix settles it. */
const repeatsIn = (nth: (k: number) => bigint, monotoneFrom: number): boolean => {
  const prefix = Array.from({ length: monotoneFrom + 8 }, (_, k) => nth(k));
  return new Set(prefix).size < prefix.length;
};

function scalarEntry(head: string, nth: (k: number) => bigint, monotoneFrom: number): NumberKernel {
  const scan = scanMembership(head, nth, monotoneFrom);
  return {
    declared: sequence(repeatsIn(nth, monotoneFrom)),
    head,
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => nth(r) as unknown as number,
    valid: (element) => {
      const v = toBigInt(element);
      return v !== undefined && scan.contains(v);
    },
    rank: (element) => {
      const v = toBigInt(element);
      return v === undefined ? -1 : scan.rankOf(v);
    },
  };
}

/** The families as TS kernels: where a family has an Epsil definition (./sequence-definitions.ts), the
 *  fast path of it and its independent reading in tests. */
export const kernels: NumberKernel[] = bigAware([
  scalarEntry("FibonacciNumbers", (k) => fibonacci.nth(k), 0),
  scalarEntry("LucasNumbers", (k) => lucas.nth(k), 1),
  scalarEntry("JacobsthalNumbers", (k) => jacobsthal.nth(k), 0),
  scalarEntry("PellNumbers", (k) => pell.nth(k), 0),
  scalarEntry("TribonacciNumbers", (k) => tribonacci.nth(k), 0),
  scalarEntry("PadovanSequence", (k) => padovan.nth(k), 4),
  scalarEntry("PerrinSequence", (k) => perrin.nth(k), 4),
  scalarEntry("CatalanNumbers", (k) => catalan.nth(k), 0),
  scalarEntry("BellNumbers", bellNth, 0),
  scalarEntry("FubiniNumbers", fubiniNth, 0),
  scalarEntry("MotzkinNumbers", (k) => motzkin.nth(k), 0),
  scalarEntry("PartitionNumbers", partitionNth, 0),
  scalarEntry("CentralDelannoyNumbers", (k) => centralDelannoy.nth(k), 0),
  scalarEntry("LittleSchroderNumbers", (k) => littleSchroder.nth(k), 0),
  scalarEntry("SchroederNumbers", schroederNth, 0),
  {
    declared: sequence(true),
    head: "SternDiatomicSequence",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => fusc(r) as unknown as number,
    valid: (element) => {
      const v = toBigInt(element);
      return v !== undefined && v >= 0n;
    },
    rank: (element) => {
      const v = toBigInt(element);
      if (v === undefined || v < 0n) return -1;
      for (let i = 0; i <= 20_000; i++) if (fusc(i) === v) return i;
      // Every non-negative integer occurs, so one not met by the scan is out of its reach, not absent.
      return declineScan("SternDiatomicSequence", v);
    },
  },
  {
    declared: sequence(true),
    head: "ThueMorseNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => thueMorse(r) as unknown as number,
    valid: (element) => {
      const v = toBigInt(element);
      return v === 0n || v === 1n;
    },
    rank: (element) => {
      const v = toBigInt(element);
      if (v === 0n) return 0;
      if (v === 1n) return 1;
      return -1;
    },
  },
]);

export const entries: (NumberKernel | EpsilFamily)[] = withSequenceDefinitions(kernels);
