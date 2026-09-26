// Segmented-sieve PrimePi/NthPrime overrides through the engine (declare-fast-primes.ts,
// issue #205). Unit coverage of the sieve itself lives in
// packages/symbols/arithmetic/residues/tests/sieve.test.ts; this file is the engine wiring.
//
// compute-engine's own "Prime" head is derivative notation (f′) -- it is not, and never
// should be, widened to mean nth-prime here (see the PR history around #273/#276).
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

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
