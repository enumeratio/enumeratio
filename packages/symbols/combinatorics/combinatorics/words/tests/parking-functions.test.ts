// ParkingFunctions defined in Epsil: against its TS kernel, against an independent reading (every
// car parks) over every word, and the interpreter against compiled code.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn } from "../../collections/src/families/epsil.ts";
import { parkingFunctions } from "../src/families/parking-functions.ts";
import {
  IsParkingFunctionOf,
  ParkingFunctionCount,
  ParkingFunctionRank,
  ParkingFunctionUnrank,
} from "../src/families/tableaux-trees.ts";

/** The TS kernel, an independent reading: its memo outgrows the definitions' past n = 9 or so. */
const fast = {
  count: ([n]: number[]) => ParkingFunctionCount(n),
  unrank: ([n]: number[], r: number) => ParkingFunctionUnrank(n, r),
  rank: (x: number[], [n]: number[]) => ParkingFunctionRank(x, n),
  valid: (x: unknown, [n]: number[]) => IsParkingFunctionOf(x, n),
};

const DEEP = process.env.DEEP_TESTS === "1";
const ce = bareEngine();
const kernel = epsilKernelOn(ce, parkingFunctions);

/** Every word of `length` over 1..`top`. */
const words = (length: number, top: number): number[][] =>
  length === 0 ? [[]] : words(length - 1, top).flatMap((w) => Array.from({ length: top }, (_, i) => [...w, i + 1]));

/** Cars with these preferences all park on a street of `n` spots. */
function parks(prefs: number[], n: number): boolean {
  const taken = new Set<number>();
  for (const p of prefs) {
    let spot = p;
    while (taken.has(spot)) spot++;
    if (spot > n) return false;
    taken.add(spot);
  }
  return true;
}

test("(n + 1)^(n − 1) of them", () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => Number(kernel.count([n])))).toEqual([1, 1, 3, 16, 125, 1296]);
});

for (const n of [0, 1, 2, 3, 4, 5]) {
  test(`ParkingFunctions(${n}) is every preference list that parks, in lex order`, () => {
    const expected = words(n, n).filter((w) => parks(w, n));
    expect(kernel.count([n])).toBe(BigInt(expected.length));
    expected.forEach((word, r) => {
      expect(kernel.unrank([n], BigInt(r))).toEqual(word);
      expect(kernel.rank(word, [n])).toBe(BigInt(r));
      expect(fast.unrank([n], r)).toEqual(word);
    });
  });
}

test("membership over every word near the family", () => {
  for (let n = 0; n <= 3; n++)
    for (const word of [...words(n, n + 1), ...words(n + 1, n), ...words(Math.max(n - 1, 0), n)]) {
      const expected = word.length === n && word.every((a) => a >= 1 && a <= n) && parks(word, n);
      expect([word, kernel.valid(word, [n])]).toEqual([word, expected]);
      expect([word, fast.valid(word, [n])]).toEqual([word, expected]);
    }
});

test("larger fibers agree with the TS kernel at sampled ranks", () => {
  for (const n of DEEP ? [6, 7, 8, 9] : [6, 7]) {
    const total = Number(fast.count([n]));
    expect(kernel.count([n])).toBe(BigInt(total));
    for (const r of [0, 1, Math.floor(total / 3), Math.floor(total / 2), total - 1]) {
      const word = fast.unrank([n], r);
      expect(kernel.unrank([n], BigInt(r))).toEqual(word);
      expect(kernel.valid(word, [n])).toBe(true);
      expect(kernel.rank(word, [n])).toBe(BigInt(r));
    }
  }
});

test("a fiber the TS kernel's memo can't reach is answered", () => {
  // 15 cars: 16^14 members, past 2^53; 14 cars: 15^13, the last a double holds.
  const word = kernel.unrank([14], 123456789012345n);
  expect(word).toHaveLength(14);
  expect(kernel.valid(word, [14])).toBe(true);
  expect(kernel.rank(word, [14])).toBe(123456789012345n);
});

test("the interpreter agrees with compiled code", () => {
  for (const [n, r] of [
    [3, 5],
    [4, 70],
  ]) {
    const word = fast.unrank([n], r);
    const list = ["List", ...(word as number[])];
    expect(evaluateEpsil(ce, parkingFunctions.epsil.unrank, { _n: n, _r: r })).toEqual(list);
    expect(evaluateEpsil(ce, parkingFunctions.epsil.rank, { _n: n, _x: list })).toBe(r);
    expect(evaluateEpsil(ce, parkingFunctions.epsil.valid, { _n: n, _x: list })).toBe("True");
  }
});

test("past 2^53 the count is exact and unrank and rank decline", () => {
  // 18^16 > 2^53, where the TS kernel's count was a rounded double.
  expect(kernel.count([17])).toBe(18n ** 16n);
  expect(() => kernel.unrank([17], 0n)).toThrow(RangeError);
});
