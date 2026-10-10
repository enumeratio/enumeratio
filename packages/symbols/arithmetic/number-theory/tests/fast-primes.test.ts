// Segmented-sieve PrimePi/NthPrime overrides through the engine (declare-fast-primes.ts,
// issue #205). Unit coverage of the sieve itself lives in
// packages/symbols/arithmetic/residues/tests/sieve.test.ts; this file is the engine wiring.
//
// compute-engine's own "Prime" head is derivative notation (f′) -- it is not, and never
// should be, widened to mean nth-prime here (see the PR history around #273/#276).
import type { Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "@enumeratio/numerals";
import { declareResidues } from "@enumeratio/residues";
import { declareNumberTheory } from "../src/declare.ts";

const ce = createEngine(declareResidues, declareNumerals, declareNumberTheory);
const run = (expr: unknown): unknown => ce.box(expr as Json).evaluate().json;

test("PrimePi/NthPrime through the engine (issue #205)", () => {
  expect(run(["PrimePi", 10000000])).toBe(664579);
  expect(run(["PrimePi", 1])).toBe(0);
  expect(run(["PrimePi", 2])).toBe(1);
  expect(run(["PrimePi", 100])).toBe(25);
  expect(run(["NthPrime", 100000])).toBe(1299709);
  expect(run(["NthPrime", 1])).toBe(2);
});

test("PrimePi/NthPrime past the segmented sieve's range, via Lucy_Hedgehog (issue #205's remaining punchlist item)", () => {
  expect(run(["PrimePi", 1000000000])).toBe(50847534);
  expect(run(["PrimePi", 100000000000])).toBe(4118054813);
  expect(run(["NthPrime", 100000000])).toBe(2038074743);
});

test("compute-engine's native Prime (derivative notation) is untouched", () => {
  // Prime(f, n) is the nth derivative notation; a plain integer argument is not a function,
  // so it should behave exactly as bare compute-engine does -- never nth-prime.
  const result = ce.box(["Prime", 100000]).evaluate();
  expect(result.operator).toBe("Prime");
});

test("PrimePi past Lucy_Hedgehog's range counts combinatorially (BL-156)", () => {
  expect(run(["PrimePi", 1000000000000])).toBe(37607912018);
  expect(run(["PrimePi", 10 ** 13])).toBe(346065536839);
  expect(run(["PrimePi", 2 ** 40])).toBe(41203088796);
});

test("PrimePi/NthPrime past the exact tiers decline at once instead of grinding natively", () => {
  const start = Date.now();
  expect(ce.box(["PrimePi", 10 ** 16]).evaluate().operator).toBe("PrimePi");
  expect(ce.box(["PrimePi", 10 ** 15 + 1]).evaluate().operator).toBe("PrimePi");
  expect(ce.box(["PrimePi", { num: "100000000000000001" }]).evaluate().operator).toBe("PrimePi");
  expect(ce.box(["NthPrime", 10 ** 13]).evaluate().operator).toBe("NthPrime");
  expect(Date.now() - start).toBeLessThan(2000);
});
