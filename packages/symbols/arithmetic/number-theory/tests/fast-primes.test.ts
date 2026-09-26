// Segmented-sieve PrimePi/NthPrime/Prime overrides through the engine (declare-fast-
// primes.ts, issue #205). Unit coverage of the sieve itself lives in
// packages/symbols/arithmetic/residues/tests/sieve.test.ts; this file is the engine wiring,
// including the Prime/NthPrime naming seam (compute-engine's own "Prime" is derivative
// notation, f').
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("PrimePi/NthPrime/Prime through the engine (issue #205)", () => {
  expect(run(["PrimePi", 10000000])).toBe(664579);
  expect(run(["PrimePi", 1])).toBe(0);
  expect(run(["PrimePi", 2])).toBe(1);
  expect(run(["PrimePi", 100])).toBe(25);
  expect(run(["NthPrime", 100000])).toBe(1299709);
  expect(run(["NthPrime", 1])).toBe(2);
  // Wolfram/sympy call this "Prime" -- compute-engine's own "Prime" head is derivative
  // notation (f'), so a plain positive-integer argument is the nth-prime shortcut and
  // anything else (a function, e.g.) is unaffected.
  expect(run(["Prime", 100000])).toBe(1299709);
  expect(run(["Prime", 5])).toBe(11);
});
