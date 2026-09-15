import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHypercomplex } from "../src/declare.ts";
import {
  BRUTE_FORCE_LIMIT,
  distinctPrimeCount,
  factorize,
  imaginaryUnitsMod,
  powerModList,
  splitUnitCountMod,
  splitUnitsMod,
} from "../src/modular.ts";

const ce = new ComputeEngine();
declareHypercomplex(ce);

/** Brute-force oracle: every x in [0,m) with x² ≡ target. Independent of the CRT route. */
const bruteForce = (target: 1 | -1, m: number): number[] => {
  const want = ((target % m) + m) % m;
  const found: number[] = [];
  for (let x = 0; x < m; x++) if ((x * x) % m === want) found.push(x);
  return found;
};

test("the CRT construction agrees with brute force, for 1 and for −1", () => {
  for (let m = 1; m <= 200; m++) {
    expect(splitUnitsMod(m), `split units mod ${m}`).toEqual(bruteForce(1, m));
    expect(imaginaryUnitsMod(m), `imaginary units mod ${m}`).toEqual(bruteForce(-1, m));
  }
});

test("odd m has exactly 2^ω(m) split units — one per ±1 spectral sign vector", () => {
  for (let m = 1; m <= 400; m += 2) {
    expect(splitUnitsMod(m).length, `mod ${m}`).toBe(2 ** distinctPrimeCount(m));
  }
});

test("the 2-adic channel is the exception to that law", () => {
  // ℤ/2 has one root of 1, ℤ/4 has two, ℤ/2^a for a ≥ 3 has four — which is why the
  // clean 2^ω(m) count is stated for odd m only.
  expect(splitUnitsMod(2)).toEqual([1]);
  expect(splitUnitsMod(4)).toEqual([1, 3]);
  expect(splitUnitsMod(8)).toEqual([1, 3, 5, 7]);
  expect(splitUnitsMod(16)).toEqual([1, 7, 9, 15]);
  expect(splitUnitsMod(8).length).not.toBe(2 ** distinctPrimeCount(8));
});

test("the closed-form count matches the enumeration everywhere", () => {
  for (let m = 1; m <= 300; m++) {
    expect(splitUnitCountMod(m), `mod ${m}`).toBe(splitUnitsMod(m).length);
  }
});

test("√−1 exists mod m iff every odd prime factor is ≡ 1 (mod 4) and 4 ∤ m", () => {
  const shouldExist = (m: number): boolean =>
    factorize(m).every(([p, a]) => (p === 2 ? a === 1 : p % 4 === 1));
  for (let m = 1; m <= 300; m++) {
    expect(imaginaryUnitsMod(m).length > 0, `mod ${m}`).toBe(shouldExist(m));
  }
  expect(imaginaryUnitsMod(5)).toEqual([2, 3]); // 2² = 4 ≡ −1
  expect(imaginaryUnitsMod(13)).toEqual([5, 8]);
  expect(imaginaryUnitsMod(65)).toEqual([8, 18, 47, 57]); // two channels → four roots
  expect(imaginaryUnitsMod(15)).toEqual([]); // 3 ≡ 3 (mod 4)
});

test("Hensel lifting carries √−1 up a prime power", () => {
  // 2² ≡ −1 (mod 5); the lift must satisfy it mod 25, 125, 625 — not just mod 5.
  for (const a of [1, 2, 3, 4]) {
    const m = 5 ** a;
    const roots = imaginaryUnitsMod(m);
    expect(roots.length, `mod ${m}`).toBe(2);
    for (const r of roots) expect((r * r) % m, `${r}² mod ${m}`).toBe(m - 1);
  }
  expect(imaginaryUnitsMod(25)).toEqual([7, 18]); // 7² = 49 = 50 − 1
});

test("a split unit of ℤ/m realises j_1 — the identities transport", () => {
  // 4 is a non-trivial split unit mod 15 (4² = 16 ≡ 1), so j_1 ↦ 4 is a ring
  // homomorphism ℝ[j]/(j²−1) → ℤ/15. The symbolic identity (1+j_1)(1−j_1) = 0 must
  // therefore hold in ℤ/15: (1+4)(1−4) = −15 ≡ 0.
  expect(splitUnitsMod(15)).toEqual([1, 4, 11, 14]);
  expect(ce.parse("(1+j_1)(1-j_1)").evaluate().json).toBe(0);
  expect(ce.box(["Mod", ["Multiply", ["Add", 1, 4], ["Subtract", 1, 4]], 15]).evaluate().json).toBe(
    0,
  );
  // And the idempotent (1+j_1)/2 lands on an idempotent residue: (1+4)/2 = 5·8 = 40 ≡ 10,
  // and 10² = 100 ≡ 10 (mod 15).
  expect(ce.box(["Mod", ["Multiply", 10, 10], 15]).evaluate().json).toBe(10);
});

test("PowerModList is the head: one general form, not a bespoke pair", () => {
  // Wolfram's PowerModList[a, 1/r, m] — the split units of ℤ/m are the square roots
  // of 1, its imaginary units the square roots of −1. No `SplitUnits` head needed.
  expect(ce.box(["PowerModList", 1, ["Divide", 1, 2], 15]).evaluate().json).toEqual([
    "List",
    1,
    4,
    11,
    14,
  ]);
  expect(ce.box(["PowerModList", -1, ["Divide", 1, 2], 13]).evaluate().json).toEqual([
    "List",
    5,
    8,
  ]);
  expect(ce.box(["PowerModList", -1, ["Divide", 1, 2], 15]).evaluate().json).toEqual(["List"]);
  // An integer exponent is an ordinary power, as in Wolfram: 2^10 = 1024 ≡ 24 (mod 100).
  expect(ce.box(["PowerModList", 2, 10, 100].slice() as never).evaluate().json).toEqual([
    "List",
    24,
  ]);
  expect(ce.box(["PowerModList", 1, ["Divide", 1, 2], "m"]).evaluate().operator).toBe(
    "PowerModList",
  );
});

test("PowerModList handles roots beyond the square, by scanning", () => {
  // Cube roots of 1 mod 7: x³ ≡ 1 has three solutions, since 3 | 7−1.
  expect(ce.box(["PowerModList", 1, ["Divide", 1, 3], 7]).evaluate().json).toEqual([
    "List",
    1,
    2,
    4,
  ]);
  // 8 has THREE cube roots mod 13 (2, 5, 6) because 3 divides 13−1 — the same reason
  // 1 has three. A single root would be the wrong answer here.
  expect(ce.box(["PowerModList", 8, ["Divide", 1, 3], 13]).evaluate().json).toEqual([
    "List",
    2,
    5,
    6,
  ]);
  expect(ce.box(["PowerModList", 2, ["Divide", 1, 2], 7]).evaluate().json).toEqual(["List", 3, 4]);
});

test("the exact square-root path is unbounded; other roots are capped", () => {
  // ±1 square roots go through CRT + Hensel, so a modulus past the scan limit is fine.
  const big = 5 ** 12; // 244 140 625, well past BRUTE_FORCE_LIMIT
  expect(big).toBeGreaterThan(BRUTE_FORCE_LIMIT);
  const roots = powerModList(-1, 2, big);
  expect(roots?.length).toBe(2);
  for (const r of roots ?? []) expect((BigInt(r) * BigInt(r)) % BigInt(big)).toBe(BigInt(big - 1));
  // A cube root at that size would need a scan, so it declines instead.
  expect(powerModList(1, 3, big)).toBeUndefined();
});
