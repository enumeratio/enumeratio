import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";
import { kroneckerSymbol } from "../src/kronecker.ts";

const ce = new ComputeEngine();
declareModular(ce);

// Pinned against a Wolfram kernel — the full a, n ∈ [-10, 10] grid. Regenerate with
// `node scripts/collect-kronecker-golden.ts` (requires wolframscript on PATH).
const GOLDEN = fileURLToPath(new URL("./kronecker.golden.json", import.meta.url));
const golden: readonly { a: number; n: number; value: number }[] = JSON.parse(
  readFileSync(GOLDEN, "utf8"),
);

test("KroneckerSymbol matches the Wolfram kernel over a, n ∈ [-10, 10]", () => {
  for (const { a, n, value } of golden) {
    expect(kroneckerSymbol(BigInt(a), BigInt(n)), `(${a}/${n})`).toBe(BigInt(value));
    expect(ce.box(["KroneckerSymbol", a, n]).evaluate().re, `(${a}/${n})`).toBe(value);
  }
});

test("agrees with JacobiSymbol/LegendreSymbol on their shared domain", () => {
  // Odd positive n: Kronecker specializes to Jacobi, which specializes to Legendre at
  // an odd prime. compute-engine ships both natively (0.128); this is the seam.
  for (const a of [-11, -3, 0, 1, 4, 9, 17, 30]) {
    for (const n of [1, 3, 5, 7, 9, 21, 45]) {
      const kron = ce.box(["KroneckerSymbol", a, n]).evaluate().re;
      const jac = ce.box(["JacobiSymbol", a, n]).evaluate().re;
      expect(kron, `KroneckerSymbol(${a},${n}) vs JacobiSymbol`).toBe(jac);
    }
  }
  for (const a of [-11, -3, 0, 1, 4, 9, 17, 30]) {
    for (const p of [3, 5, 7, 11, 13]) {
      const kron = ce.box(["KroneckerSymbol", a, p]).evaluate().re;
      const leg = ce.box(["LegendreSymbol", a, p]).evaluate().re;
      expect(kron, `KroneckerSymbol(${a},${p}) vs LegendreSymbol`).toBe(leg);
    }
  }
});

test("the (a/0), (a/-1) and (a/2) edge rules", () => {
  expect(kroneckerSymbol(1n, 0n)).toBe(1n);
  expect(kroneckerSymbol(-1n, 0n)).toBe(1n);
  expect(kroneckerSymbol(5n, 0n)).toBe(0n);
  expect(kroneckerSymbol(0n, 0n)).toBe(0n);
  expect(kroneckerSymbol(3n, -1n)).toBe(1n);
  expect(kroneckerSymbol(-3n, -1n)).toBe(-1n);
  expect(kroneckerSymbol(0n, -1n)).toBe(1n);
  // (a/2): 0 for even a; ±1 by a mod 8, matching odd primitive discriminants mod 8.
  expect(kroneckerSymbol(4n, 2n)).toBe(0n);
  expect(kroneckerSymbol(1n, 2n)).toBe(1n);
  expect(kroneckerSymbol(7n, 2n)).toBe(1n);
  expect(kroneckerSymbol(3n, 2n)).toBe(-1n);
  expect(kroneckerSymbol(5n, 2n)).toBe(-1n);
});

test("multiplicative in each argument", () => {
  for (const a of [2, 3, 5, 7, 11]) {
    for (const [n1, n2] of [
      [3, 5],
      [-4, 7],
      [8, -9],
    ] as const) {
      const lhs = kroneckerSymbol(BigInt(a), BigInt(n1 * n2));
      const rhs = kroneckerSymbol(BigInt(a), BigInt(n1)) * kroneckerSymbol(BigInt(a), BigInt(n2));
      expect(lhs, `(${a}/${n1 * n2})`).toBe(rhs);
    }
  }
});

test("bignum-safe past the double-precision range", () => {
  // KroneckerSymbol[10^11 + 1, Prime[2000]] against a Wolfram kernel; Prime[2000] = 17389.
  expect(kroneckerSymbol(10n ** 11n + 1n, 17389n)).toBe(-1n);
  const big = ce.box(["KroneckerSymbol", 10n ** 11n + 1n, 17389n]).evaluate();
  expect(big.re).toBe(-1);

  // A genuinely bignum pair, past 2^53 on both sides — odd n, where Kronecker specializes
  // to Jacobi and so IS periodic in a mod n (unlike the general, even-n case: e.g.
  // KroneckerSymbol[45, 22] = -1 but KroneckerSymbol[45 mod 22, 22] = KroneckerSymbol[1, 22]
  // = 1, since the (a/2) factor depends on a mod 8, not a mod n).
  const a = 10n ** 30n + 7n;
  const n = 2n * (10n ** 25n + 3n) + 1n;
  expect(kroneckerSymbol(a, n)).toBe(kroneckerSymbol(a % n, n));
});
