// Binary-splitting Factorial(n) (declare-fast-factorial.ts, issue #205): exact against a
// naive sequential-multiply reference, including n = 0, 1, and the bench's own case through
// Mod.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";
import { factorial } from "../src/fast-factorial.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

function naiveFactorial(n: bigint): bigint {
  let r = 1n;
  for (let k = 2n; k <= n; k++) r *= k;
  return r;
}

test("factorial agrees with a naive sequential-multiply reference, 0..300", () => {
  for (let n = 0n; n <= 300n; n++) {
    expect(factorial(n)).toBe(naiveFactorial(n));
  }
});

test("bench golden values (issue #205)", () => {
  expect(factorial(100000n) % 1000000007n).toBe(457992974n);
});

test("Factorial through the engine: fast path and the non-integer/negative fallback", () => {
  expect(run(["Factorial", 0])).toBe(1);
  expect(run(["Factorial", 1])).toBe(1);
  expect(run(["Factorial", 10])).toBe(3628800);
  expect(run(["Mod", ["Factorial", 100000], 1000000007])).toBe(457992974);
  // Non-integer/negative arguments are untouched -- the Gamma-function extension answers,
  // same as before this override existed.
  const half = ce.box(["Factorial", 0.5]).evaluate();
  expect(half.isNumber).toBe(true);
});
