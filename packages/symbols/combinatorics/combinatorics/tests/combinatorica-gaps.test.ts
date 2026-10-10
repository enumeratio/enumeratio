// TransposePartition, Eulerian and MahonianNumber against independent readings: the partition
// diagram, and permutations enumerated with their descents and inversions counted by hand.

import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../src/index.ts";
import { MAHONIAN_EPSIL, mahonianNumber } from "../permutations/src/mahonian.ts";
import { permutations } from "./maps-helpers.ts";

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

const value = (expr: unknown): unknown => ce.box(expr as never).evaluate().json;
const count = (expr: unknown): number => ce.box(["Count", expr] as never).evaluate().re;
const num = (n: bigint): unknown => (n > BigInt(Number.MAX_SAFE_INTEGER) ? { num: String(n) } : Number(n));

/** The partitions of n as non-increasing lists. */
function partitionsOf(n: number, max = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let part = Math.min(n, max); part >= 1; part--)
    for (const rest of partitionsOf(n - part, part)) out.push([part, ...rest]);
  return out;
}

test("TransposePartition reads the diagram by columns, and is an involution", () => {
  for (let n = 0; n <= 8; n++)
    for (const parts of partitionsOf(n)) {
      const columns = Array.from({ length: parts[0] ?? 0 }, (_, i) => parts.filter((part) => part > i).length);
      const transposed = ["IntegerPartition", ["List", ...columns]];
      expect(value(["TransposePartition", ["IntegerPartition", ["List", ...parts]]]), `[${parts.join(",")}]`).toEqual(
        transposed,
      );
      expect(value(["TransposePartition", transposed]), `[${parts.join(",")}] twice`).toEqual([
        "IntegerPartition",
        ["List", ...parts],
      ]);
    }
});

test("TransposePartition matches FindStat's Mp00044 and Combinatorica on their samples", () => {
  const transpose = (parts: number[]): unknown =>
    value(["TransposePartition", ["IntegerPartition", ["List", ...parts]]]);
  // Mp00044 sample rows, and Combinatorica's TransposePartition[{4, 2, 1}] and [{5, 3, 3, 1}].
  expect(transpose([2])).toEqual(["IntegerPartition", ["List", 1, 1]]);
  expect(transpose([4])).toEqual(["IntegerPartition", ["List", 1, 1, 1, 1]]);
  expect(transpose([4, 2, 1])).toEqual(["IntegerPartition", ["List", 3, 2, 1, 1]]);
  expect(transpose([5, 3, 3, 1])).toEqual(["IntegerPartition", ["List", 4, 3, 3, 1, 1]]);
});

const descents = (p: readonly number[]): number => p.filter((x, i) => i > 0 && p[i - 1]! > x).length;
const inversions = (p: readonly number[]): number =>
  p.reduce((total, x, i) => total + p.slice(i + 1).filter((y) => y < x).length, 0);

test("Eulerian counts the permutations by descents, and agrees with the collection", () => {
  for (let n = 0; n <= 6; n++) {
    const all = permutations(n);
    for (let k = 0; k <= n; k++) {
      const expected = all.filter((p) => descents(p) === k).length;
      expect(value(["Eulerian", n, k]), `Eulerian(${n}, ${k})`).toBe(expected);
      expect(count(["KDescentPermutations", n, k]), `KDescentPermutations(${n}, ${k})`).toBe(expected);
    }
  }
  // The engine's own Descents agrees with the hand count on a few permutations.
  for (const p of permutations(4)) expect(value(["Descents", ["List", ...p]])).toBe(descents(p));
});

test("MahonianNumber counts the permutations by inversions, and agrees with the collection", () => {
  for (let n = 0; n <= 6; n++) {
    const all = permutations(n);
    for (let k = 0; k <= (n * (n - 1)) / 2 + 1; k++) {
      const expected = all.filter((p) => inversions(p) === k).length;
      expect(value(["MahonianNumber", n, k]), `MahonianNumber(${n}, ${k})`).toBe(expected);
      expect(count(["KInversionPermutations", n, k]), `KInversionPermutations(${n}, ${k})`).toBe(expected);
    }
  }
  for (const p of permutations(4)) expect(value(["Inversions", ["List", ...p]])).toBe(inversions(p));
});

test("MahonianNumber and Eulerian: out of range, negative and symbolic arguments", () => {
  expect(value(["MahonianNumber", 3, 4])).toBe(0);
  expect(value(["Eulerian", 3, 3])).toBe(0);
  // A negative argument is left unevaluated, as compute-engine's Eulerian does.
  for (const head of ["MahonianNumber", "Eulerian"])
    for (const args of [
      [3, -1],
      [-1, 0],
    ])
      expect(value([head, ...args])).toEqual([head, ...args]);
  expect(value(["MahonianNumber", "x", 2])).toEqual(["MahonianNumber", "x", 2]);
  expect(mahonianNumber(-1n, 0n)).toBeUndefined();
  expect(mahonianNumber(3n, -1n)).toBeUndefined();
});

const factorial = (n: bigint): bigint => (n <= 1n ? 1n : n * factorial(n - 1n));
const exact = (json: unknown): bigint =>
  BigInt(typeof json === "object" && json !== null ? (json as { num: string }).num : String(json));

test("big arguments are exact, and the rows sum to n!", () => {
  // Past 2^53; the same literals are the example rows' `known`, read from Combinatorica.
  expect(value(["MahonianNumber", 30, 200])).toEqual({ num: "3099203467964807470998065439996" });
  expect(ce.box(["MahonianNumber", 30, 200] as never).N().json).toEqual({ num: "3099203467964807470998065439996" });
  expect(value(["Eulerian", 30, 10])).toEqual({ num: "1269070526794311849099687878550" });
  // Σ_k M(n, k) = n! and Σ_k A(n, k) = n!, independent of any listed value.
  let mahonian = 0n;
  for (let k = 0n; k <= 4950n; k++) mahonian += mahonianNumber(100n, k)!;
  expect(mahonian).toBe(factorial(100n));
  let eulerian = 0n;
  for (let k = 0; k < 30; k++) eulerian += exact(value(["Eulerian", 30, k]));
  expect(eulerian).toBe(factorial(30n));
  expect(mahonianNumber(30n, 100n)).toBe(mahonianNumber(30n, 335n));
  expect(exact(value(["MahonianNumber", 100, 2500]))).toBe(mahonianNumber(100n, 2500n));
});

test("the kernel declines past its work limit", () => {
  expect(mahonianNumber(100_000n, 1_000_000n)).toBeUndefined();
  expect(mahonianNumber(300n, 9999n)).toBeDefined();
});

test("the bigint kernel is held to the Epsil definition", { timeout: 60_000 }, () => {
  const cases: [number, number][] = [];
  for (let n = 0; n <= 5; n++) for (let k = 0; k <= (n * (n - 1)) / 2 + 1; k++) cases.push([n, k]);
  cases.push([6, 7], [7, 10], [4, 40]);
  for (const [n, k] of cases) {
    const defined = evaluateEpsil(ce, MAHONIAN_EPSIL, { _n: n, _k: k });
    expect(defined, `M(${n}, ${k})`).toEqual(num(mahonianNumber(BigInt(n), BigInt(k))!));
  }
});
