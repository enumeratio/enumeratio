import { expect, test } from "vite-plus/test";
import {
  alternatingSignMatricesExact,
  binomialExact,
  catalanExact,
  fussCatalanExact,
  powerProduct,
} from "../src/families/exact-counts.ts";

/** C(n, k) by the multiplicative formula, each step an exact division. */
function binomialBy(n: number, k: number): bigint {
  let result = 1n;
  for (let i = 1; i <= k; i++) result = (result * BigInt(n - k + i)) / BigInt(i);
  return result;
}

test("binomials and Catalan numbers are exact, small and large", () => {
  for (let n = 0; n <= 60; n++)
    for (let k = 0; k <= n; k++) expect([n, k, binomialExact(n, k)]).toEqual([n, k, binomialBy(n, k)]);
  expect(binomialExact(3, 5)).toBe(0n);
  expect(binomialExact(3, -1)).toBe(0n);
  expect(binomialExact(2000, 700)).toBe(binomialBy(2000, 700));
  for (let n = 0; n <= 150; n++) expect([n, catalanExact(n)]).toEqual([n, binomialBy(2 * n, n) / BigInt(n + 1)]);
  expect(catalanExact(5)).toBe(42n);
});

test("full k-ary trees are Fuss–Catalan, and none where a node has no child", () => {
  for (let n = 0; n <= 40; n++) {
    expect(fussCatalanExact(n, 2)).toBe(catalanExact(n));
    expect(fussCatalanExact(n, 0)).toBe(0n);
    expect(fussCatalanExact(n, 1)).toBe(1n);
    for (const k of [3, 4, 7]) expect(fussCatalanExact(n, k)).toBe(binomialBy(k * n, n) / BigInt((k - 1) * n + 1));
  }
});

test("alternating sign matrices follow the product formula", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => alternatingSignMatricesExact(n))).toEqual([
    1n,
    1n,
    2n,
    7n,
    42n,
    429n,
    7436n,
    218348n,
    10850216n,
  ]);
});

test("a product past the limits is left undefined, and a non-integer ratio too", () => {
  expect(catalanExact(5_000_000)).toBeUndefined();
  expect(alternatingSignMatricesExact(20_000)).toBeUndefined();
  // The bit limit is 16 million.
  expect(powerProduct([0, 0, 40_000])).toBe(2n ** 40_000n);
  expect(powerProduct([0, 0, 17_000_000])).toBeUndefined();
  // 1/2 is no integer.
  expect(powerProduct([0, 0, -1])).toBeUndefined();
});
