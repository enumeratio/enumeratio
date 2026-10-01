import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { kSubsets, subsets } from "../src/families/closed-forms.ts";
import { kernelsOn } from "../src/families/epsil.ts";
import { entries } from "../src/families/subsets.ts";

// The subset families against an independent reading: every subset of 1..n, by size and then
// lex on the ascending members, filtered by the family's condition. The same elements in the same
// order, rank inverting unrank, and every element a member.
const ce = new ComputeEngine();
const kernels = kernelsOn(ce, [
  subsets({ head: "Subsets", params: ["_n"] }),
  kSubsets({ head: "KSubsets", params: ["_n", "_k"] }),
  ...entries,
]);

/** Every subset of 1..n, graded by size, lex within a size. */
function graded(n: number): number[][] {
  const all: number[][] = [];
  for (let mask = 0; mask < 2 ** n; mask++)
    all.push(Array.from({ length: n }, (_, i) => i + 1).filter((i) => mask & (1 << (i - 1))));
  return all.toSorted((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
}

const READINGS: Record<string, { params: number[][]; member: (s: number[], p: number[]) => boolean }> = {
  Subsets: { params: [[0], [1], [3], [5]], member: () => true },
  KSubsets: {
    params: [
      [0, 0],
      [4, 2],
      [5, 3],
      [3, 4],
    ],
    member: (s, [, k]) => s.length === k,
  },
  SubsetsWithoutConsecutive: {
    params: [[0], [1], [4], [6]],
    member: (s) => s.every((x, i) => i === 0 || x - s[i - 1] > 1),
  },
  SubsetsOfSizeAtMost: {
    params: [
      [4, 2],
      [5, 3],
      [3, 3],
    ],
    member: (s, [, k]) => s.length <= k,
  },
  EvenSubsets: { params: [[0], [1], [4], [5]], member: (s) => s.length % 2 === 0 },
  OddSubsets: { params: [[1], [4], [5]], member: (s) => s.length % 2 === 1 },
};

for (const kernel of kernels) {
  const reading = READINGS[kernel.head]!;
  for (const p of reading.params) {
    test(`${kernel.head}(${p.join(", ")}) is graded by size, lex within a size`, () => {
      const expected = graded(p[0]).filter((s) => reading.member(s, p));
      expect(kernel.count(p)).toBe(BigInt(expected.length));
      expected.forEach((s, r) => {
        expect(kernel.unrank(p, BigInt(r))).toEqual(s);
        expect(kernel.rank(s, p)).toBe(BigInt(r));
        expect(kernel.valid(s, p)).toBe(true);
      });
    });
  }
}
