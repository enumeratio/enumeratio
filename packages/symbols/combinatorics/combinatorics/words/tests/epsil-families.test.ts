// The words-area families defined in Epsil (BL-30), each against its TS kernel: the same count,
// the same element at every rank, rank inverting unrank, and the same membership over members
// and near misses. Compiled and interpreted, and past 2^53 where the interpreter's exact
// integers take over.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn } from "../../collections/src/families/epsil.ts";
import {
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
  IsFibonacciWord,
} from "../../collections/src/families/kernels-extra.ts";
import { stirlingCount, stirlingRank, stirlingUnrank, stirlingValid } from "../src/families/binary-word-families.ts";
import { entries as binaryEntries } from "../src/families/binary-word-families.ts";
import {
  IsNonDecreasingParkingFunctionOf,
  NonDecreasingParkingFunctionCount,
  NonDecreasingParkingFunctionRank,
  NonDecreasingParkingFunctionUnrank,
  entries as tableauxEntries,
} from "../src/families/tableaux-trees.ts";
import {
  byWeightCount,
  byWeightRank,
  byWeightUnrank,
  byWeightValid,
  entries as wordEntries,
  lucasCount,
  lucasStringsRank,
  lucasStringsUnrank,
  lucasStringsValid,
} from "../src/families/words.ts";

const ce = bareEngine();
// The larger parameter points and the past-2^53 round trips (the interpreter takes minutes over
// StirlingPermutations there) run nightly.
const DEEP = process.env.DEEP_TESTS === "1";

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => number[];
  readonly rank: (x: number[], p: number[]) => number;
  readonly valid: (x: number[], p: number[]) => boolean;
}

const READINGS: Record<string, Reading> = {
  BinaryWordsByWeight: {
    params: [[0, 0], [1, 0], [1, 1], [3, 5], [4, 2], [5, 0], [5, 5], [6, 3], ...(DEEP ? [[8, 3]] : [])],
    count: ([n, k]) => byWeightCount(n, k),
    unrank: ([n, k], r) => byWeightUnrank(n, k, r),
    rank: (x, [n, k]) => byWeightRank(x, n, k),
    valid: (x, [n, k]) => byWeightValid(x, n, k),
  },
  FibStrings: {
    params: [[0], [1], [2], [3], [5], ...(DEEP ? [[8], [12]] : [])],
    count: ([n]) => FibonacciWordCount(n),
    unrank: ([n], r) => FibonacciWordUnrank(n, r),
    rank: (x) => FibonacciWordRank(x),
    valid: (x, [n]) => IsFibonacciWord(x, n),
  },
  LucasStrings: {
    params: [[0], [1], [2], [3], [4], [5], ...(DEEP ? [[8], [11]] : [])],
    count: ([n]) => lucasCount(n),
    unrank: ([n], r) => lucasStringsUnrank(n, r),
    rank: (x, [n]) => lucasStringsRank(x, n),
    valid: (x, [n]) => lucasStringsValid(x, n),
  },
  StirlingPermutations: {
    params: [[0], [1], [2], [3], [4], ...(DEEP ? [[5]] : [])],
    count: ([n]) => stirlingCount(n),
    unrank: ([n], r) => stirlingUnrank(n, r),
    rank: (x, [n]) => stirlingRank(x, n),
    valid: (x, [n]) => stirlingValid(x, n),
  },
  NonDecreasingParkingFunctions: {
    params: [[0], [1], [2], [3], [4], [6], ...(DEEP ? [[8]] : [])],
    count: ([n]) => NonDecreasingParkingFunctionCount(n),
    unrank: ([n], r) => NonDecreasingParkingFunctionUnrank(n, r),
    rank: (x, [n]) => NonDecreasingParkingFunctionRank(x, n),
    valid: (x, [n]) => IsNonDecreasingParkingFunctionOf(x, n),
  },
};

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}

/** Words one step from a member: an entry moved by 1, two entries swapped, one entry cut or added. */
const nearMisses = (member: number[]): number[][] => [
  ...member.flatMap((_, i) => [1, -1].map((d) => member.map((v, j) => (i === j ? v + d : v)))),
  ...member.flatMap((_, i) =>
    member
      .slice(i + 1)
      .map((__, k) => member.map((v, j) => (j === i ? member[i + 1 + k] : j === i + 1 + k ? member[i] : v))),
  ),
  member.slice(0, -1),
  [...member, 1],
];

const byHead = new Map([...wordEntries, ...binaryEntries, ...tableauxEntries].map((family) => [family.head, family]));

for (const [head, reading] of Object.entries(READINGS)) {
  const family = byHead.get(head) as EpsilFamily;
  const kernel = kernelOn(ce, family);
  for (const p of reading.params) {
    test(`${head}(${p.join(", ")}) agrees with its TS kernel`, () => {
      const total = reading.count(p);
      expect(kernel.count(p)).toBe(BigInt(total));
      const members = new Set<string>();
      const candidates: number[][] = [];
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r)) as number[];
        expect(element).toEqual(reading.unrank(p, r));
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        expect(reading.rank(element, p)).toBe(r);
        expect(kernel.valid(element, p)).toBe(true);
        members.add(element.join());
        candidates.push(...nearMisses(element));
      }
      // Every word over the values the family uses, where that is small enough to list.
      const length = (reading.unrank(p, 0) ?? []).length;
      if (3 ** length <= 3000) candidates.push(...words(length, [0, 1, 2]));
      if (3 ** length <= 3000 && length > 0) candidates.push(...words(length, [1, 2, 3]));
      for (const candidate of candidates)
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, reading.valid(candidate, p)]);
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) => {
  const { tables } = family.epsil;
  const tabled = tables === undefined ? bindings : { ...bindings, _tables: evaluateEpsil(ce, tables, bindings) };
  return evaluateEpsil(ce, family.epsil[operation], tabled);
};

const list = (xs: unknown[]): unknown => ["List", ...xs.map((x) => (Array.isArray(x) ? list(x) : x))];

test("the interpreter agrees with the TS kernels", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = byHead.get(head) as EpsilFamily;
    const p = reading.params.at(-2)!;
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect(interpreted(family, "count", bind)).toBe(total);
    for (const r of [0, Math.floor(total / 2), total - 1]) {
      const element = reading.unrank(p, r);
      expect(interpreted(family, "unrank", { ...bind, _r: r })).toEqual(list(element));
      expect(interpreted(family, "rank", { ...bind, _x: list(element) })).toBe(r);
      expect(interpreted(family, "valid", { ...bind, _x: list(element) })).toBe("True");
    }
  }
});

/** Exact integers: past 2^53 the interpreter answers; rank inverts unrank across the fiber. */
function roundTrips(head: string, p: number[], total: bigint): void {
  const kernel = kernelOn(ce, byHead.get(head) as EpsilFamily);
  expect(kernel.count(p)).toBe(total);
  expect(total).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
  for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
    const element = kernel.unrank(p, r);
    expect(kernel.valid(element, p)).toBe(true);
    expect(kernel.rank(element, p)).toBe(r);
  }
}

test.skipIf(!DEEP)("past 2^53 BinaryWordsByWeight answers in exact integers", () => {
  const [n, k] = [80, 40];
  let total = 1n;
  for (let i = 1n; i <= BigInt(k); i++) total = (total * (BigInt(n) - i + 1n)) / i;
  roundTrips("BinaryWordsByWeight", [n, k], total);
  const kernel = kernelOn(ce, byHead.get("BinaryWordsByWeight") as EpsilFamily);
  expect(kernel.unrank([n, k], total - 1n)).toEqual([...Array(k).fill(1), ...Array(n - k).fill(0)]);
});

test.skipIf(!DEEP)("past 2^53 FibStrings and LucasStrings answer in exact integers", () => {
  const n = 90;
  let [a, b] = [1n, 2n]; // words of length 0, 1
  const fib = [a, b];
  for (let m = 2; m <= n; m++) fib.push(fib[m - 1] + fib[m - 2]);
  roundTrips("FibStrings", [n], fib[n]);
  roundTrips("LucasStrings", [n], fib[n - 1] + fib[n - 3]);
});

test.skipIf(!DEEP)("past 2^53 StirlingPermutations answers in exact integers", () => {
  const n = 20;
  let total = 1n;
  for (let k = 2n; k <= BigInt(n); k++) total *= 2n * k - 1n;
  roundTrips("StirlingPermutations", [n], total);
});

test.skipIf(!DEEP)("past 2^53 NonDecreasingParkingFunctions answers in exact integers", () => {
  const n = 34;
  let catalan = 1n; // C(2n, n) / (n + 1)
  for (let i = 1n; i <= BigInt(n); i++) catalan = (catalan * (2n * BigInt(n) - i + 1n)) / i;
  roundTrips("NonDecreasingParkingFunctions", [n], catalan / BigInt(n + 1));
});
