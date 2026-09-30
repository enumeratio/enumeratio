// The closed-form Epsil families (src/families/closed-forms.ts) against their independent TS
// readings: the same count, the same element at every rank, rank inverting unrank, and the same
// membership over every word near the family. Compiled and interpreted, and the interpreter checked
// directly against the definitions too.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import {
  PruferSequenceCount,
  PruferSequenceRank,
  PruferSequenceUnrank,
  IsPruferSequenceOf,
} from "../../trees/src/families/prufer-sequences.ts";
import { ternaryGrayList } from "../../words/src/families/binary-word-families.ts";
import {
  grayCodeCount,
  grayCodeRank,
  grayCodeUnrank,
  palindromeCount,
  palindromeRank,
  palindromeUnrank,
  palindromeValid,
} from "../../words/src/families/words.ts";
import { allFamilies, type EpsilFamily, isEpsilFamily, kernelOn } from "../src/families/index.ts";
import {
  BinaryStringCount,
  IsKSubsetOf,
  IsMultisetOf,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  MultisetCount,
  MultisetRank,
  MultisetUnrank,
  BinaryStringRank,
  BinaryStringUnrank,
  GrayCodeSubsetRank,
  GrayCodeSubsetUnrank,
  IsBinaryString,
  IsSubsetOf,
  IsTupleOf,
  SubsetCount,
  SubsetRank,
  SubsetUnrank,
  TupleCount,
  TupleRank,
  TupleUnrank,
} from "../src/families/kernels-extra.ts";

const ce = new ComputeEngine();

interface Reading {
  readonly params: readonly number[][];
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => number[];
  readonly rank: (x: number[], p: number[]) => number;
  readonly valid: (x: number[], p: number[]) => boolean;
  /** The letters a word near the family is drawn from. */
  readonly letters: (p: number[]) => number[];
}

const span = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Every word of length `length` over `alphabet`. */
function words(length: number, alphabet: readonly number[]): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, alphabet).flatMap((w) => alphabet.map((a) => [...w, a]));
}

/** Words one step from `member`: a letter changed, dropped, repeated or added. */
function mutations(member: number[], letters: number[]): number[][] {
  const out: number[][] = [
    [...member, letters[0]],
    [letters.at(-1)!, ...member],
    [...member, ...member.slice(0, 1)],
  ];
  if (member.length > 0) out.push(member.slice(1), member.slice(0, -1));
  member.forEach((_, i) => {
    for (const letter of letters) out.push(member.map((x, j) => (j === i ? letter : x)));
  });
  // A member's first letter written twice is the near miss a set or permutation check must see.
  if (member.length > 1) out.push([member[0], ...member.slice(0, 1), ...member.slice(1)]);
  return out;
}

const READINGS: Record<string, Reading> = {
  Subsets: {
    params: [[0], [1], [2], [3], [4]],
    count: ([n]) => SubsetCount(n),
    unrank: ([n], r) => SubsetUnrank(n, r),
    rank: (x) => SubsetRank(x),
    valid: (x, [n]) => IsSubsetOf(x, n),
    letters: ([n]) => span(0, n + 1),
  },
  GrayCodeSubsets: {
    params: [[0], [1], [2], [3], [4]],
    count: ([n]) => SubsetCount(n),
    unrank: ([n], r) => GrayCodeSubsetUnrank(n, r),
    rank: (x) => GrayCodeSubsetRank(x),
    valid: (x, [n]) => IsSubsetOf(x, n),
    letters: ([n]) => span(0, n + 1),
  },
  KSubsets: {
    params: [
      [0, 0],
      [3, 0],
      [3, 1],
      [4, 2],
      [5, 3],
      [2, 3],
      [4, 4],
    ],
    count: ([n, k]) => KSubsetCount(n, k),
    unrank: ([n, k], r) => KSubsetUnrank(n, k, r),
    rank: (x) => KSubsetRank(x),
    valid: (x, [n, k]) => IsKSubsetOf(x, n, k),
    letters: ([n]) => span(0, n + 1),
  },
  Multisets: {
    params: [
      [0, 0],
      [1, 3],
      [3, 0],
      [3, 2],
      [2, 4],
      [4, 3],
    ],
    count: ([n, k]) => MultisetCount(n, k),
    unrank: ([n, k], r) => MultisetUnrank(n, k, r),
    rank: (x) => MultisetRank(x),
    valid: (x, [n, k]) => IsMultisetOf(x, n, k),
    letters: ([n]) => span(0, n + 1),
  },
  Tuples: {
    params: [
      [0, 0],
      [0, 2],
      [2, 0],
      [1, 3],
      [2, 3],
      [3, 2],
      [3, 3],
    ],
    count: ([n, k]) => TupleCount(n, k),
    unrank: ([n, k], r) => TupleUnrank(n, k, r),
    rank: (x, [n]) => TupleRank(x, n),
    valid: (x, [n, k]) => IsTupleOf(x, n, k),
    letters: ([n]) => span(0, n + 1),
  },
  Words: {
    params: [
      [0, 0],
      [2, 0],
      [0, 2],
      [3, 1],
      [3, 2],
      [2, 3],
    ],
    count: ([size, base]) => TupleCount(base, size),
    unrank: ([size, base], r) => TupleUnrank(base, size, r),
    rank: (x, [, base]) => TupleRank(x, base),
    valid: (x, [size, base]) => IsTupleOf(x, base, size),
    letters: ([, base]) => span(0, base + 1),
  },
  Endofunctions: {
    params: [[0], [1], [2], [3], [4]],
    count: ([n]) => n ** n,
    unrank: ([n], r) => TupleUnrank(n, n, r),
    rank: (x, [n]) => TupleRank(x, n),
    valid: (x, [n]) => IsTupleOf(x, n, n),
    letters: ([n]) => span(0, n + 1),
  },
  PruferSequences: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => PruferSequenceCount(n),
    unrank: ([n], r) => PruferSequenceUnrank(n, r),
    rank: (x, [n]) => PruferSequenceRank(x, n),
    valid: (x, [n]) => IsPruferSequenceOf(x, n),
    letters: ([n]) => span(0, n + 1),
  },
  BinaryStrings: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => BinaryStringCount(n),
    unrank: ([n], r) => BinaryStringUnrank(n, r),
    rank: (x) => BinaryStringRank(x),
    valid: (x, [n]) => IsBinaryString(x, n),
    letters: () => [-1, 0, 1, 2],
  },
  BinaryWords: {
    params: [[0], [1], [3], [5]],
    count: ([n]) => BinaryStringCount(n),
    unrank: ([n], r) => BinaryStringUnrank(n, r),
    rank: (x) => BinaryStringRank(x),
    valid: (x, [n]) => IsBinaryString(x, n),
    letters: () => [-1, 0, 1, 2],
  },
  GrayCodes: {
    params: [[0], [1], [2], [3], [4], [5]],
    count: ([n]) => grayCodeCount(n),
    unrank: ([n], r) => grayCodeUnrank(n, r),
    rank: (x) => grayCodeRank(x),
    valid: (x, [n]) => x.length === n && x.every((b) => b === 0 || b === 1),
    letters: () => [-1, 0, 1, 2],
  },
  BinaryPalindromes: {
    params: [[0], [1], [2], [3], [4], [5], [6]],
    count: ([n]) => palindromeCount(n),
    unrank: ([n], r) => palindromeUnrank(n, r),
    rank: (x, [n]) => palindromeRank(x, n),
    valid: (x, [n]) => palindromeValid(x, n),
    letters: () => [-1, 0, 1, 2],
  },
  TernaryGrayCodes: {
    params: [[0], [1], [2], [3]],
    count: ([n]) => 3 ** n,
    unrank: ([n], r) => ternaryGrayList(n)[r],
    rank: (x, [n]) => ternaryGrayList(n).findIndex((w) => w.length === x.length && w.every((d, i) => d === x[i])),
    valid: (x, [n]) => x.length === n && x.every((d) => d === 0 || d === 1 || d === 2),
    letters: () => [-1, 0, 1, 2, 3],
  },
};

const byHead = new Map(allFamilies.filter(isEpsilFamily).map((family) => [family.head, family]));

for (const [head, reading] of Object.entries(READINGS)) {
  const family = byHead.get(head)!;
  const kernel = kernelOn(ce, family);
  for (const p of reading.params) {
    test(`${head}(${p.join(", ")}) agrees with its TS reading`, () => {
      const total = reading.count(p);
      expect(kernel.count(p)).toBe(BigInt(total));
      const members: number[][] = [];
      for (let r = 0; r < total; r++) {
        const element = kernel.unrank(p, BigInt(r)) as number[];
        expect(element).toEqual(reading.unrank(p, r));
        expect(kernel.rank(element, p)).toBe(BigInt(r));
        expect(reading.rank(element, p)).toBe(r);
        members.push(element);
      }
      const letters = reading.letters(p);
      const near = [
        ...span(0, 3).flatMap((length) => words(length, letters)),
        ...members.flatMap((member) => mutations(member, letters)),
      ];
      for (const candidate of near)
        expect([candidate, kernel.valid(candidate, p)]).toEqual([candidate, reading.valid(candidate, p)]);
    });
  }
}

/** The definitions as the interpreter reads them, bypassing compiled code. */
const interpreted = (family: EpsilFamily, operation: keyof EpsilFamily["epsil"], bindings: Record<string, unknown>) =>
  evaluateEpsil(ce, family.epsil[operation], bindings);

const list = (xs: number[]): unknown => ["List", ...xs];

test("the interpreter agrees with the readings", () => {
  for (const [head, reading] of Object.entries(READINGS)) {
    const family = byHead.get(head)!;
    const p = reading.params.at(-1)!;
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

test("past 2^53 the families answer in exact integers", () => {
  const check = (head: string, p: number[], total: bigint) => {
    const kernel = kernelOn(ce, byHead.get(head)!);
    expect(kernel.count(p)).toBe(total);
    for (const r of [0n, 1n, total / 3n, total - 1n]) {
      const element = kernel.unrank(p, r);
      expect(kernel.valid(element, p)).toBe(true);
      expect(kernel.rank(element, p)).toBe(r);
    }
  };
  check("BinaryStrings", [60], 2n ** 60n);
  check("GrayCodes", [60], 2n ** 60n);
  check("Subsets", [60], 2n ** 60n);
  check("GrayCodeSubsets", [60], 2n ** 60n);
  check("BinaryPalindromes", [119], 2n ** 60n);
  check("TernaryGrayCodes", [40], 3n ** 40n);
  check("Tuples", [10, 20], 10n ** 20n);
});

test("a subset's rank does not depend on the order it is listed in", () => {
  for (const [head, p] of [
    ["Subsets", [5]],
    ["GrayCodeSubsets", [5]],
    ["KSubsets", [6, 3]],
  ] as const) {
    const kernel = kernelOn(ce, byHead.get(head)!);
    for (let r = 0n; r < kernel.count([...p]); r += 3n) {
      const element = kernel.unrank([...p], r) as number[];
      expect(kernel.rank(element.toReversed(), [...p])).toBe(r);
    }
  }
});

test("GrayCodes neighbours differ in one place, TernaryGrayCodes neighbours by one in one place", () => {
  const gray = kernelOn(ce, byHead.get("GrayCodes")!);
  const ternary = kernelOn(ce, byHead.get("TernaryGrayCodes")!);
  const steps = (kernel: ReturnType<typeof kernelOn>, p: number[]) => {
    const total = Number(kernel.count(p));
    return span(1, total - 1).map((r) => {
      const [a, b] = [kernel.unrank(p, BigInt(r - 1)), kernel.unrank(p, BigInt(r))] as number[][];
      return a.map((x, i) => Math.abs(x - b[i])).toSorted((x, y) => y - x);
    });
  };
  for (const s of steps(gray, [6])) expect(s).toEqual([1, ...Array(5).fill(0)]);
  for (const s of steps(ternary, [4])) expect(s).toEqual([1, ...Array(3).fill(0)]);
});
