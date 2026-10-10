// StandardTableauPairs defined in Epsil: the RSK of the permutation of each rank, against a plain RSK
// over the permutations in lex order. The definitions are interpreted (a nested element has no
// compiled type), a few hundred milliseconds an operation, so the Epsil kernel is asked a few
// ranks; the TS kernel, its fast path, is held to the plain RSK over every rank.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { standardTableauPairs } from "../src/families/rsk-pairs.ts";
import { standardTableauPairsFast as fast } from "../src/families/standard-tableau-pairs.ts";

const kernel = epsilKernelOn(bareEngine(), standardTableauPairs);

type Pair = [number[][], number[][]];

const permutations = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutations(n - 1).flatMap((p) =>
        [...Array(n)].map((_, i) => [...p.slice(0, i), n, ...p.slice(i)]).toSorted(lex),
      );
function lex(a: number[], b: number[]): number {
  const i = a.findIndex((x, j) => x !== b[j]);
  return i < 0 ? 0 : a[i] - b[i];
}
const sortedPermutations = (n: number): number[][] => permutations(n).toSorted(lex);

/** Row insertion: each entry bumps the smallest larger one down a row; Q records where each cell appeared. */
function rsk(word: number[]): Pair {
  const P: number[][] = [];
  const Q: number[][] = [];
  word.forEach((entry, step) => {
    let x = entry;
    for (let r = 0; ; r++) {
      if (r === P.length) {
        P.push([x]);
        Q.push([step + 1]);
        return;
      }
      const j = P[r].findIndex((y) => y > x);
      if (j < 0) {
        P[r].push(x);
        Q[r].push(step + 1);
        return;
      }
      [P[r][j], x] = [x, P[r][j]];
    }
  });
  return [P, Q];
}

test("n! pairs, exactly past 2^53 where unrank and rank decline", () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => kernel.count([n]))).toEqual([1n, 1n, 2n, 6n, 24n, 120n]);
  expect(kernel.count([25])).toBe(15511210043330985984000000n);
  expect(() => kernel.unrank([25], 0n)).toThrow(RangeError);
});

for (const n of [0, 1, 2, 3, 4, 5]) {
  test(`the TS kernel lists StandardTableauPairs(${n}) as the RSK of each permutation in lex order`, () => {
    sortedPermutations(n).forEach((p, r) => {
      const pair = rsk(p);
      expect(fast.unrank([n], r)).toEqual(pair);
      expect(fast.rank(pair, [n])).toBe(r);
      expect(fast.valid(pair, [n])).toBe(true);
    });
  });
}

test("StandardTableauPairs(2) is the RSK of each permutation in lex order", () => {
  sortedPermutations(2).forEach((p, r) => {
    const pair = rsk(p);
    expect(kernel.unrank([2], BigInt(r))).toEqual(pair);
    expect(kernel.valid(pair, [2])).toBe(true);
    expect(kernel.rank(pair, [2])).toBe(BigInt(r));
  });
});

test("StandardTableauPairs(3) agrees at its first, middle and last rank", () => {
  const all = sortedPermutations(3);
  for (const r of [0, 3, 5]) {
    const pair = rsk(all[r]);
    expect(kernel.unrank([3], BigInt(r))).toEqual(pair);
    expect(kernel.rank(pair, [3])).toBe(BigInt(r));
  }
});

test("membership: both halves standard tableaux of one shape, and nothing else", () => {
  const member: Pair = [
    [[1, 2], [3]],
    [[1, 3], [2]],
  ];
  const near: [unknown, boolean][] = [
    [member, true],
    [
      [
        [[1, 3], [2]],
        [[1, 2], [3]],
      ],
      true,
    ],
    [[[[1, 2], [3]], [[1, 2, 3]]], false],
    [
      [
        [[1, 2], [3]],
        [[1], [2], [3]],
      ],
      false,
    ],
    [
      [
        [[1, 2], [3]],
        [[1, 3], [3]],
      ],
      false,
    ],
    [
      [
        [[1, 2], [3]],
        [[2, 1], [3]],
      ],
      false,
    ],
    [[[[1, 2], [3]]], false],
    [[[1, 2], [3]], false],
    [[1, 2], false],
    [[[[1]], [[1]]], false],
  ];
  for (const [x, expected] of near) expect([x, kernel.valid(x as never, [3])]).toEqual([x, expected]);
  for (const [x] of near) expect(fast.valid(x as never, [3])).toBe(kernel.valid(x as never, [3]));
});

// Interpreted, about 0.4 s a pair: every pair of n = 4 is for DEEP_TESTS.
test.skipIf(process.env.DEEP_TESTS !== "1")(
  "StandardTableauPairs(4) is the RSK of each permutation in lex order",
  () => {
    sortedPermutations(4).forEach((p, r) => {
      const pair = rsk(p);
      expect(kernel.unrank([4], BigInt(r))).toEqual(pair);
      expect(kernel.valid(pair, [4])).toBe(true);
      expect(kernel.rank(pair, [4])).toBe(BigInt(r));
    });
  },
  60_000,
);

test("a rank left unreduced by the interpreter is settled", () => {
  // Inverse RSK's last fold step is left unreduced by compute-engine; the family opts in to settling it.
  expect(standardTableauPairs.settle).toBe(true);
  const pair = rsk(sortedPermutations(3)[4]);
  expect(kernel.rank(pair, [3])).toBe(4n);
});
