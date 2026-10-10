// FinePaths defined in Epsil: against its TS kernel (its fast path), against an independent
// reading of "a Dyck path with no hill" over every word, and the interpreter against compiled code.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { epsilKernelOn, evaluateTables } from "../../collections/src/families/epsil.ts";
import { finePathsFast } from "../../collections/src/families/paths-partitions.ts";
import { finePaths } from "../src/families/fine-paths.ts";

const ce = bareEngine();
const kernel = epsilKernelOn(ce, finePaths);

/** Every word of `length` over 0 and 1. */
const words = (length: number): number[][] =>
  length === 0
    ? [[]]
    : words(length - 1).flatMap((w) => [
        [...w, 0],
        [...w, 1],
      ]);

/** A Dyck path (1 up, 0 down) none of whose ground-level up steps is followed by a down step. */
function isFinePath(word: number[]): boolean {
  let height = 0;
  for (let i = 0; i < word.length; i++) {
    if (height === 0 && word[i] === 1 && word[i + 1] === 0) return false;
    height += word[i] === 1 ? 1 : -1;
    if (height < 0) return false;
  }
  return height === 0;
}

test("the Fine numbers", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => Number(kernel.count([n])))).toEqual([
    1, 0, 1, 2, 6, 18, 57, 186, 622, 2120,
  ]);
});

for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) {
  test(`FinePaths(${n}) agrees with its TS kernel`, () => {
    const total = Number(finePathsFast.count([n]));
    expect(kernel.count([n])).toBe(BigInt(total));
    for (let r = 0; r < total; r++) {
      const element = kernel.unrank([n], BigInt(r));
      expect(element).toEqual(finePathsFast.unrank([n], r));
      expect(kernel.valid(element, [n])).toBe(true);
      expect(kernel.rank(element, [n])).toBe(BigInt(r));
    }
  });
}

test("membership is a Dyck path with no hill, over every word near the family", () => {
  for (let n = 0; n <= 4; n++)
    for (const word of [...words(2 * n), ...words(2 * n + 1).slice(0, 40), ...words(Math.max(2 * n - 1, 0))]) {
      const expected = word.length === 2 * n && isFinePath(word);
      expect([word, kernel.valid(word, [n])]).toEqual([word, expected]);
      expect([word, finePathsFast.valid(word, [n])]).toEqual([word, expected]);
    }
});

test("the interpreter agrees with compiled code", () => {
  const p = 6;
  const tables = evaluateTables(ce, finePaths.epsil.tables, { _n: p });
  for (const r of [0, 20, 56]) {
    const path = finePathsFast.unrank([p], r);
    const list = ["List", ...(path as number[])];
    expect(evaluateEpsil(ce, finePaths.epsil.unrank, { _n: p, _r: r, _tables: tables })).toEqual(list);
    expect(evaluateEpsil(ce, finePaths.epsil.rank, { _n: p, _x: list, _tables: tables })).toBe(r);
    expect(evaluateEpsil(ce, finePaths.epsil.valid, { _n: p, _x: list })).toBe("True");
  }
});

test("past 2^53 the count is exact", () => {
  // The TS kernel's doubles end at n = 29; the Fine numbers satisfy F(n) = Σ_{m ≥ 2} C(m − 1) F(n − m).
  const catalan = [1n];
  for (let k = 0; k < 40; k++) catalan.push((catalan[k] * BigInt(4 * k + 2)) / BigInt(k + 2));
  const fine = [1n, 0n];
  for (let k = 2; k <= 40; k++) {
    let sum = 0n;
    for (let m = 2; m <= k; m++) sum += catalan[m - 1] * fine[k - m];
    fine.push(sum);
  }
  expect(kernel.count([40])).toBe(fine[40]);
  expect(fine[40] > 2n ** 53n).toBe(true);
});
