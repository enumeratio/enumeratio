// Fast-doubling Fibonacci/LucasL (declare-fast-recurrence.ts, issue #205's performance
// punchlist): every fast path must agree with a naive reference over a range including the
// edges Wolfram's conventions care about — n = 0, 1, negative indices, a modulus that
// divides the value, p = 1 — not just the bench's own three cases.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";
import { fibonacci, fibonacciMod, lucasL, lucasLMod } from "../src/fast-recurrence.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

function naiveFib(n: bigint): bigint {
  if (n === 0n) return 0n;
  let [a, b] = [0n, 1n];
  for (let i = 2n; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
function naiveLucas(n: bigint): bigint {
  if (n === 0n) return 2n;
  let [a, b] = [2n, 1n];
  for (let i = 2n; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

test("fibonacci/lucasL agree with a naive O(n) reference, 0..60 and negative indices", () => {
  for (let n = 0n; n <= 60n; n++) {
    expect(fibonacci(n)).toBe(naiveFib(n));
    expect(lucasL(n)).toBe(naiveLucas(n));
    if (n > 0n) {
      // Wolfram's conventions: F(-n) = (-1)^(n+1) F(n), L(-n) = (-1)^n L(n).
      expect(fibonacci(-n)).toBe(n % 2n === 0n ? -naiveFib(n) : naiveFib(n));
      expect(lucasL(-n)).toBe(n % 2n === 1n ? -naiveLucas(n) : naiveLucas(n));
    }
  }
});

test("fibonacciMod/lucasLMod agree with exact-value-then-reduce, including p | value and p = 1", () => {
  const moduli = [1n, 2n, 3n, 7n, 1000000007n];
  for (const p of moduli) {
    for (let n = -50n; n <= 50n; n++) {
      const expectedFib = ((fibonacci(n) % p) + p) % p;
      expect(fibonacciMod(n, p)).toBe(expectedFib);
      const expectedLucas = ((lucasL(n) % p) + p) % p;
      expect(lucasLMod(n, p)).toBe(expectedLucas);
    }
  }
});

test("bench golden values (issue #205)", () => {
  expect(fibonacciMod(100000n, 1000000007n)).toBe(911435502n);
  expect(fibonacciMod(1000000n, 1000000007n)).toBe(918091266n);
  expect(lucasLMod(100000n, 1000000007n)).toBe(23800955n);
});

test("Fibonacci/LucasL through the engine: fast path, Binet and the polynomial form all still work", () => {
  expect(run(["Fibonacci", 0])).toBe(0);
  expect(run(["Fibonacci", 1])).toBe(1);
  expect(run(["Fibonacci", 10])).toBe(55);
  expect(run(["Fibonacci", -5])).toBe(5);
  expect(run(["LucasL", 10])).toBe(123);
  expect(run(["Mod", ["Fibonacci", 100000], 1000000007])).toBe(911435502);
  expect(run(["Mod", ["Fibonacci", 1000000], 1000000007])).toBe(918091266);
  expect(run(["Mod", ["LucasL", 100000], 1000000007])).toBe(23800955);
  // Non-integer order still goes through Binet's formula (unaffected by the integer fast path).
  const half = ce.box(["Fibonacci", 1.5]).evaluate();
  expect(half.isNumber).toBe(true);
  // The two-argument polynomial form is still reachable (arity 1 gates the fast path off it).
  expect(run(["Fibonacci", 7, "x"])).not.toBeUndefined();
});

test("unrelated Mod calls are unaffected", () => {
  expect(run(["Mod", 7, 3])).toBe(1);
  expect(run(["Mod", ["Add", ["Fibonacci", 10], 1], 1000])).toBe(56);
});
