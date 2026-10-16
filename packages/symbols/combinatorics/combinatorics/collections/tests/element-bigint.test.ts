// Element / IndexOf / Successor on integers past 2^53, through a real engine: a big exact integer
// reaches the kernels as a bigint, never rounded to a double, and a kernel that can't read it
// (or a param past 2^53) leaves the call unevaluated rather than answering False.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { kernels as digitsPrimes } from "../src/families/numeric-digits-primes.ts";
import { kernels as recurrence } from "../src/families/numeric-recurrence.ts";
import { numberKernel } from "../src/families/types.ts";
import { declareCollections } from "../src/library.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const ce = bareEngine();
declareCollections(ce);

const big = (n: bigint) => ({ num: n.toString() });
const run = (expr: unknown) => ce.box(expr as never).evaluate();
const element = (n: bigint, head: string) => run(["Element", big(n), head]).toString();
const fibonacci = (n: number): bigint => {
  let [a, b] = [0n, 1n];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
};

test("Fibonacci terms past 2^53 are members, their neighbours are not", () => {
  const f100 = fibonacci(100);
  expect(element(f100, "FibonacciNumbers")).toBe('"True"');
  expect(element(f100 + 1n, "FibonacciNumbers")).toBe('"False"');
  expect(element(f100 - 1n, "FibonacciNumbers")).toBe('"False"');
  expect(run(["IndexOf", "FibonacciNumbers", big(f100)]).re).toBe(101);
  expect(run(["Successor", "FibonacciNumbers", big(f100)]).toString()).toBe(fibonacci(101).toString());
});

test("factorials, triangular and square numbers past 2^53", () => {
  const f25 = Array.from({ length: 25 }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b);
  expect(element(f25, "FactorialNumbers")).toBe('"True"');
  expect(element(f25 + 1n, "FactorialNumbers")).toBe('"False"');
  const t = (10n ** 12n * (10n ** 12n + 1n)) / 2n;
  expect(element(t, "TriangularNumbers")).toBe('"True"');
  expect(element(t + 1n, "TriangularNumbers")).toBe('"False"');
  expect(element(10n ** 24n, "SquareNumbers")).toBe('"True"');
  expect(element(10n ** 24n + 1n, "SquareNumbers")).toBe('"False"');
  expect(element(10n ** 24n - 1n, "SquareNumbers")).toBe('"False"');
});

test("primes past 2^53: members True, non-members False, never rounded", () => {
  expect(element(2n ** 89n - 1n, "PrimeNumbers")).toBe('"True"');
  expect(element(2n ** 89n + 1n, "PrimeNumbers")).toBe('"False"'); // divisible by 3
  expect(element(10n ** 24n + 7n, "PrimeNumbers")).toBe('"True"');
  expect(element(10n ** 24n + 9n, "PrimeNumbers")).toBe('"False"');
  // Past 2^53 the rank is out of reach: unknown, not 0.
  expect(run(["IndexOf", "PrimeNumbers", big(2n ** 89n - 1n)]).operator).toBe("IndexOf");
});

test("a safe-range integer answers as before", () => {
  expect(run(["Element", 8, "FibonacciNumbers"]).toString()).toBe('"True"');
  expect(run(["Element", 9, "FibonacciNumbers"]).toString()).toBe('"False"');
  expect(run(["Element", 1299709, "PrimeNumbers"]).toString()).toBe('"True"');
  expect(run(["IndexOf", "FibonacciNumbers", 8]).re).toBe(7);
  expect(run(["Element", 1.5, "TriangularNumbers"]).toString()).toBe('"False"');
});

test("a kernel in plain numbers declines a bigint element instead of rounding it", () => {
  const harshad = numberKernel(digitsPrimes.find((k) => k.head === "HarshadNumbers")!);
  expect(() => harshad.valid(10n ** 24n, [])).toThrow(/not bigint yet/);
  expect(() => harshad.rank(10n ** 24n, [])).toThrow(/not bigint yet/);
  expect(run(["Element", big(10n ** 24n), "HarshadNumbers"]).operator).toBe("Element");
});

test("a scan that ran out of terms declines instead of answering absent", () => {
  const kernelOf = (head: string) => numberKernel(recurrence.find((k) => k.head === head)!);
  const jacobsthal = kernelOf("JacobsthalNumbers");
  // J(n) = (2^n - (-1)^n) / 3: a term within the scan is a member, a value past its last term is unknown.
  expect(jacobsthal.valid((2n ** 100n - 1n) / 3n, [])).toBe(true);
  expect(jacobsthal.valid((2n ** 100n - 1n) / 3n + 1n, [])).toBe(false);
  expect(() => jacobsthal.valid(10n ** 7000n, [])).toThrow(/not bigint yet/);
  expect(() => jacobsthal.rank(10n ** 7000n, [])).toThrow(/not bigint yet/);
  // Every integer occurs in the diatomic sequence, so one the scan never met has a rank it can't give.
  const stern = kernelOf("SternDiatomicSequence");
  expect(stern.rank(5n, [])).toBeGreaterThan(0n);
  expect(() => stern.rank(10n ** 9n, [])).toThrow(/not bigint yet/);
});

test("a param past 2^53 leaves the call unevaluated, not answered for another fiber", () => {
  const huge = big(10n ** 20n);
  expect(run(["Element", 5, ["SmoothNumbers", huge]]).operator).toBe("Element");
  expect(run(["At", ["SmoothNumbers", huge], 3]).operator).toBe("At");
  expect(run(["Count", ["SmoothNumbers", huge]]).operator).toBe("Count");
});

test("Position and FirstPosition do not walk an endless collection", () => {
  expect(run(["Position", "FibonacciNumbers", 8]).operator).toBe("Position");
  expect(run(["FirstPosition", "FibonacciNumbers", 8]).operator).toBe("FirstPosition");
});

test.skipIf(!DEEP)("terms far past 2^53 (DEEP_TESTS)", () => {
  const f1000 = fibonacci(1000);
  expect(element(f1000, "FibonacciNumbers")).toBe('"True"');
  expect(element(f1000 + 1n, "FibonacciNumbers")).toBe('"False"');
  expect(element(2n ** 3000n, "PowersOfTwo")).toBe('"True"');
  expect(element(2n ** 3000n + 1n, "PowersOfTwo")).toBe('"False"');
});
