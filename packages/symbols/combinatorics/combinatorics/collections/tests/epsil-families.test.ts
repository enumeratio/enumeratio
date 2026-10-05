// The collections families defined in Epsil (FibonacciWords, TriStrings, GrandDyckPaths,
// RiordanPaths, BallotSequences, RecursiveTrees, SytHookShape, SytTwoRow, SytTwoColumn, and
// Multisets' table-driven unrank) against their TS kernels, which stay as the independent
// reading: the same count, the same element at every rank, rank inverting unrank, and the same
// membership over members and near misses. Compiled and interpreted; at the last size a double
// counts exactly, and (under DEEP_TESTS) past 2^53 where the interpreter's exact integers take over.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { allFamilies, type EpsilFamily, epsilKernelOn, evaluateTables, isEpsilFamily } from "../src/families/index.ts";
import {
  DyckPathCount,
  DyckPathRank,
  DyckPathUnrank,
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
  IsDyckPath,
  IsFibonacciWord,
  IsMultisetOf,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  MultisetCount,
  MultisetRank,
  MultisetUnrank,
} from "../src/families/kernels-extra.ts";
import {
  IsRecursiveTreeOf,
  IsSytHookShapeOf,
  IsSytTwoRowOf,
  RecursiveTreeCount,
  RecursiveTreeRank,
  RecursiveTreeUnrank,
  SytHookShapeCount,
  SytHookShapeRank,
  SytHookShapeUnrank,
  SytTwoRowCount,
  SytTwoRowRank,
  SytTwoRowUnrank,
} from "../src/families/tableaux-trees.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = bareEngine();
const byHead = new Map(allFamilies.filter(isEpsilFamily).map((family) => [family.head, family]));
const familyOf = (head: string): EpsilFamily => byHead.get(head)!;

// ─── Independent exact counts (BigInt), for the edge of the doubles ─────────────────────────────
const choose = (n: number, k: number): bigint => {
  let c = 1n;
  for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
  return c;
};
const catalan = (n: number): bigint => choose(2 * n, n) / BigInt(n + 1);
const fibonacciWords = (n: number): bigint => {
  let [a, b] = [1n, 2n];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
};
/** Words with no three consecutive ones: T(n) = T(n − 1) + T(n − 2) + T(n − 3). */
const triStrings = (n: number): bigint => {
  const t = [1n, 2n, 4n];
  for (let i = 3; i <= n; i++) t.push(t[i - 1] + t[i - 2] + t[i - 3]);
  return t[n];
};
const riordan = (n: number): bigint => {
  const r = [1n, 0n];
  for (let i = 2; i <= n; i++) r.push((BigInt(i - 1) * (2n * r[i - 1] + 3n * r[i - 2])) / BigInt(i + 1));
  return r[n];
};
const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));

interface Reading {
  /** The sizes checked exhaustively. */
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => unknown;
  readonly rank: (x: never, p: number[]) => number;
  readonly valid: (x: never, p: number[]) => boolean;
  /** The count at n, exactly, for the edge of the doubles; absent where the sizes aren't one n. */
  readonly exact?: (n: number) => bigint;
  /** Past 2^53 unrank and rank decline (the family sets `declinePastDoubles`); the count stays exact. */
  readonly declines?: true;
  /** Entries a word near the family is drawn from, for every near word of a flat family. */
  readonly letters?: readonly number[];
}

const sizes = (n: number): number[][] => Array.from({ length: n + 1 }, (_, i) => [i]);
const WORD = [-1, 0, 1, 2];

const dyckReading = {
  count: ([n]: number[]) => DyckPathCount(n),
  unrank: ([n]: number[], r: number) => DyckPathUnrank(n, r),
  rank: (x: number[]) => DyckPathRank(x),
  valid: (x: number[], [n]: number[]) => IsDyckPath(x, n),
};
const twoRowReading: Reading = {
  params: sizes(7),
  count: ([n]) => SytTwoRowCount(n),
  unrank: ([n], r) => SytTwoRowUnrank(n, r),
  rank: (x: number[][], [n]) => SytTwoRowRank(x, n),
  valid: (x: unknown, [n]) => IsSytTwoRowOf(x, n),
  exact: (n) => choose(n, n >> 1),
  declines: true,
};

const READINGS: Record<string, Reading> = {
  FibonacciWords: {
    params: sizes(9),
    count: ([n]) => FibonacciWordCount(n),
    unrank: ([n], r) => FibonacciWordUnrank(n, r),
    rank: (x: number[]) => FibonacciWordRank(x),
    valid: (x: number[], [n]) => IsFibonacciWord(x, n),
    exact: fibonacciWords,
    letters: WORD,
  },
  TriStrings: {
    // The TS kernel is private to its module; its fast path, the family's own `fast`, reads it.
    params: sizes(9),
    count: (p) => familyOf("TriStrings").fast!.count(p),
    unrank: (p, r) => familyOf("TriStrings").fast!.unrank(p, r),
    rank: (x, p) => familyOf("TriStrings").fast!.rank(x, p),
    valid: (x, p) => familyOf("TriStrings").fast!.valid(x, p),
    exact: triStrings,
    letters: WORD,
  },
  GrandDyckPaths: {
    params: sizes(4),
    count: ([n]) => KSubsetCount(2 * n, n),
    unrank: ([n], r) => {
      const ups = new Set(KSubsetUnrank(2 * n, n, r));
      return Array.from({ length: 2 * n }, (_, i) => (ups.has(i + 1) ? 1 : 0));
    },
    rank: (x: number[]) => KSubsetRank(x.flatMap((s, i) => (s === 1 ? [i + 1] : []))),
    valid: (x: number[], [n]) =>
      x.length === 2 * n && x.every((s) => s === 0 || s === 1) && x.filter((s) => s).length === n,
    exact: (n) => choose(2 * n, n),
    letters: WORD,
  },
  RiordanPaths: {
    params: sizes(8),
    count: (p) => familyOf("RiordanPaths").fast!.count(p),
    unrank: (p, r) => familyOf("RiordanPaths").fast!.unrank(p, r),
    rank: (x, p) => familyOf("RiordanPaths").fast!.rank(x, p),
    valid: (x, p) => familyOf("RiordanPaths").fast!.valid(x, p),
    exact: riordan,
    letters: WORD,
  },
  BallotSequences: { ...dyckReading, params: sizes(5), exact: catalan, letters: WORD },
  RecursiveTrees: {
    params: sizes(6),
    count: ([n]) => RecursiveTreeCount(n),
    unrank: ([n], r) => RecursiveTreeUnrank(n, r),
    rank: (x: number[], [n]) => RecursiveTreeRank(x, n),
    valid: (x: number[], [n]) => IsRecursiveTreeOf(x, n),
    exact: (n) => factorial(n - 1),
  },
  SytHookShape: {
    params: sizes(6),
    count: ([n]) => SytHookShapeCount(n),
    unrank: ([n], r) => SytHookShapeUnrank(n, r),
    rank: (x: number[][], [n]) => SytHookShapeRank(x, n),
    valid: (x: unknown, [n]) => IsSytHookShapeOf(x, n),
    exact: (n) => 2n ** BigInt(n - 1),
  },
  SytTwoRow: twoRowReading,
  // The TS kernel reads the transpose as the very same pair of rows.
  SytTwoColumn: twoRowReading,
  Multisets: {
    params: [
      [0, 0],
      [3, 2],
      [2, 5],
      [4, 4],
      [6, 3],
    ],
    count: ([n, k]) => MultisetCount(n, k),
    unrank: ([n, k], r) => MultisetUnrank(n, k, r),
    rank: (x: number[]) => MultisetRank(x),
    valid: (x: number[], [n, k]) => IsMultisetOf(x, n, k),
  },
};

// ─── Candidates near a family ───────────────────────────────────────────────────────────────────
const clone = (x: unknown): unknown => (Array.isArray(x) ? x.map(clone) : x);

/** Elements a step from `member`: a leaf moved by one, an entry dropped, repeated or reversed. */
function neighbours(member: unknown): unknown[] {
  if (!Array.isArray(member)) return [(member as number) + 1, (member as number) - 1];
  const out: unknown[] = [[...member, clone(member[0] ?? 1)], member.toReversed()];
  member.forEach((child, i) => {
    for (const moved of neighbours(child)) out.push(member.map((c, j) => (i === j ? moved : c)));
    out.push(member.filter((_, j) => j !== i));
  });
  return out;
}

/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}

const list = (x: unknown): unknown => (Array.isArray(x) ? ["List", ...x.map(list)] : x);

for (const [head, reading] of Object.entries(READINGS)) {
  const kernel = epsilKernelOn(ce, familyOf(head));
  test(`${head} agrees with its TS kernel`, () => {
    for (const p of reading.params) {
      const total = reading.count(p);
      expect([head, p, kernel.count(p)]).toEqual([head, p, BigInt(total)]);
      const members: unknown[] = [];
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r));
        expect([head, p, r, element]).toEqual([head, p, r, reading.unrank(p, r)]);
        expect(kernel.valid(element, p)).toBe(true);
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        expect(reading.rank(element as never, p)).toBe(r);
        members.push(element);
      }
      const near = [
        ...members.flatMap(neighbours),
        ...(reading.letters === undefined
          ? []
          : [p[0] - 1, p[0], p[0] + 1, 2 * p[0]]
              .filter((length) => length >= 0 && 4 ** length <= 4096)
              .flatMap((length) => words(length, reading.letters!))),
      ];
      for (const candidate of near)
        expect([head, p, candidate, kernel.valid(candidate, p)]).toEqual([
          head,
          p,
          candidate,
          reading.valid(candidate as never, p),
        ]);
    }
  });
}

// ─── The interpreter, on the definitions as written ─────────────────────────────────────────────
/** The definitions as the interpreter reads them, bypassing compiled code; `_tables` as the kernel builds it. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) => {
  const { tables } = family.epsil;
  const tabled = tables === undefined ? bindings : { ...bindings, _tables: evaluateTables(ce, tables, bindings) };
  return evaluateEpsil(ce, family.epsil[operation], tabled);
};

test("the interpreter agrees with the TS kernels", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = familyOf(head);
    const p = reading.params[Math.min(3, reading.params.length - 1)];
    const bind = Object.fromEntries(family.params.map((name, i) => [name, p[i]]));
    const total = reading.count(p);
    expect([head, interpreted(family, "count", bind)]).toEqual([head, total]);
    for (const r of new Set([0, Math.floor(total / 2), total - 1])) {
      const element = reading.unrank(p, r);
      expect([head, interpreted(family, "unrank", { ...bind, _r: r })]).toEqual([head, list(element)]);
      expect([head, interpreted(family, "rank", { ...bind, _x: list(element) })]).toEqual([head, r]);
      expect([head, interpreted(family, "valid", { ...bind, _x: list(element) })]).toEqual([head, "True"]);
      for (const near of neighbours(element)
        .filter((_, i) => i % 3 === 0)
        .slice(0, 8))
        expect([head, near, interpreted(family, "valid", { ...bind, _x: list(near) }) === "True"]).toEqual([
          head,
          near,
          reading.valid(near as never, p),
        ]);
    }
  }
});

// ─── The doubles' edge, and past it ─────────────────────────────────────────────────────────────
// Compiled code computes in doubles and answers while a fiber's count is a safe integer: at the
// last such size every rank asked is inverted exactly (the TS kernels are no reading there, their
// intermediate sums can pass the count); past it, the interpreter's exact integers answer.
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const exactRanks = (total: bigint): bigint[] => [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n];

function checkAt(head: string, n: number, exact: (n: number) => bigint): void {
  const kernel = epsilKernelOn(ce, familyOf(head));
  const total = exact(n);
  expect([head, n, kernel.count([n])]).toEqual([head, n, total]);
  let previous: unknown;
  for (const r of exactRanks(total)) {
    const element = kernel.unrank([n], r);
    expect([head, n, r, kernel.valid(element, [n])]).toEqual([head, n, r, true]);
    expect([head, n, r, kernel.rank(element, [n])]).toEqual([head, n, r, r]);
    expect(JSON.stringify(element)).not.toBe(JSON.stringify(previous));
    previous = element;
  }
}

/** The largest n whose count a double holds. */
const edgeOf = (exact: (n: number) => bigint): number => {
  let n = 1;
  while (exact(n + 1) <= MAX_SAFE) n++;
  return n;
};

for (const [head, reading] of Object.entries(READINGS).filter(([, r]) => r.exact !== undefined)) {
  const edge = edgeOf(reading.exact!);
  test(`${head}(${edge}), the last size a double counts, round-trips exactly`, () => {
    checkAt(head, edge, reading.exact!);
  });
  test.skipIf(!DEEP)(
    `${head}(${edge + 3}), past 2^53, ${reading.declines ? "declines" : "answers in exact integers"}`,
    () => {
      if (reading.declines === undefined) return checkAt(head, edge + 3, reading.exact!);
      const kernel = epsilKernelOn(ce, familyOf(head));
      expect(kernel.count([edge + 3])).toBe(reading.exact!(edge + 3));
      expect(() => kernel.unrank([edge + 3], 0n)).toThrow(RangeError);
    },
  );
}

// ─── Multisets: a long multiset is a table lookup per digit, not a search per digit ─────────────
test("Multisets(10, 80) unranks and ranks through its table", () => {
  const kernel = epsilKernelOn(ce, familyOf("Multisets"));
  const p = [10, 80];
  const total = choose(89, 80);
  expect(kernel.count(p)).toBe(total);
  for (const r of [0n, 12345678901n, total / 2n, total - 1n]) {
    const element = kernel.unrank(p, r);
    expect(kernel.valid(element, p)).toBe(true);
    expect(kernel.rank(element, p)).toBe(r);
  }
});
