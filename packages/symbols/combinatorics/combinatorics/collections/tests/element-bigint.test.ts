// Element / IndexOf / Successor on integers past 2^53, through a real engine: a big exact integer
// reaches the kernels as a bigint, never rounded to a double, and a kernel that can't read it
// (or a param past 2^53) leaves the call unevaluated rather than answering False.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn, liftFamily } from "../src/families/epsil.ts";
import { kernels as digitsPrimes } from "../src/families/numeric-digits-primes.ts";
import { entries as sequenceEntries, kernels as recurrence } from "../src/families/numeric-recurrence.ts";
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

// A family whose Epsil definitions say nothing (valid is False), to isolate `early` and `fast` in kernelOn.
const synthetic = (early: EpsilFamily["early"], fast?: EpsilFamily["fast"]): EpsilFamily => ({
  head: "Synthetic",
  paramCount: 0,
  kind: "scalar",
  params: [],
  epsil: { count: "PositiveInfinity", unrank: 0, rank: 0, valid: "False" },
  ...(early === undefined ? {} : { early }),
  ...(fast === undefined ? {} : { fast }),
});
const yes: NonNullable<EpsilFamily["fast"]> = {
  count: () => Number.POSITIVE_INFINITY,
  unrank: () => undefined,
  rank: () => 7,
  valid: () => true,
};

test("a fast path that reads bigints answers ahead of early.member's decline; false still wins", () => {
  const huge = 10n ** 30n;
  const declines = { member: () => "decline" as const, rank: () => "decline" as const };
  expect(kernelOn(ce, synthetic(declines, { ...yes, bigElements: true })).valid(huge, [])).toBe(true);
  expect(kernelOn(ce, synthetic(declines, { ...yes, bigElements: true })).rank(huge, [])).toBe(7n);
  // Not flagged: the bigint never reaches it, so the decline stands.
  expect(() => kernelOn(ce, synthetic(declines, yes)).valid(huge, [])).toThrow(/not bigint yet/);
  expect(() => kernelOn(ce, synthetic(declines, yes)).rank(huge, [])).toThrow(/not bigint yet/);
  // early.member says no member: that settles it, whatever the fast path thinks.
  const never = synthetic({ member: () => false }, { ...yes, bigElements: true });
  expect(kernelOn(ce, never).valid(huge, [])).toBe(false);
});

test("a safe integer past the interpreter's reach is the fast path's to answer", () => {
  expect(run(["Element", 1000000007, "PrimeNumbers"]).toString()).toBe('"True"');
  expect(run(["Element", 1000000011, "PrimeNumbers"]).toString()).toBe('"False"'); // 3 divides it
  expect(run(["Element", 999999999999989, ["SmoothNumbers", 1e15]]).toString()).toBe('"True"');
});

test("rank past the interpreter's maxBits is the fast scan's, or declines with membership", () => {
  const kernel = kernelOn(ce, liftFamily(sequenceEntries.find((f) => f.head === "FibonacciNumbers")!));
  const f5000 = fibonacci(5000);
  expect(f5000 >= 1n << 2200n).toBe(true);
  expect(kernel.valid(f5000, [])).toBe(true);
  expect(kernel.rank(f5000, [])).toBe(5000n);
  // Past the scan's terms, both decline: no 28,000-step fold in the interpreter.
  const started = performance.now();
  const f20000 = fibonacci(20000);
  expect(() => kernel.valid(f20000, [])).toThrow(/not bigint yet/);
  expect(() => kernel.rank(f20000, [])).toThrow(/not bigint yet/);
  expect(element(f20000, "FibonacciNumbers").startsWith("Element")).toBe(true);
  expect(performance.now() - started).toBeLessThan(5000);
});

test("a float past 2^53 declines instead of reading as a non-member", () => {
  expect(run(["Element", 1e30, "SquareNumbers"]).operator).toBe("Element");
  expect(run(["Element", ["N", ["Power", 2, 100]], "PowersOfTwo"]).operator).toBe("Element");
  expect(run(["Element", 1.5, "SquareNumbers"]).toString()).toBe('"False"');
});

test("work past a second's declines quickly instead of hanging or filling the heap", () => {
  const started = performance.now();
  // A scan from 1 up to 10^12, a Bell triangle past 1500 rows, a Lucky sieve of a million.
  expect(run(["IndexOf", "AbundantNumbers", big(10n ** 12n)]).operator).toBe("IndexOf");
  expect(run(["Element", big(10n ** 9000n), "BellNumbers"]).operator).toBe("Element");
  expect(run(["IndexOf", "LuckyNumbers", 10 ** 6]).operator).toBe("IndexOf");
  expect(run(["At", "TwinPrimes", 10 ** 9]).operator).toBe("At");
  expect(performance.now() - started).toBeLessThan(15_000);
});

test("a derived value past 2^53 declines: 2n + 1 for a Sophie Germain prime", () => {
  const sophie = numberKernel(digitsPrimes.find((k) => k.head === "SophieGermainPrimes")!);
  expect(sophie.valid(11, [])).toBe(true);
  expect(sophie.valid(13, [])).toBe(false);
  expect(() => sophie.valid(9007199254740881, [])).toThrow(/not bigint yet/); // 2^53 - 111, prime
});

test.skipIf(!DEEP)("terms far past 2^53 (DEEP_TESTS)", () => {
  const f1000 = fibonacci(1000);
  expect(element(f1000, "FibonacciNumbers")).toBe('"True"');
  expect(element(f1000 + 1n, "FibonacciNumbers")).toBe('"False"');
  expect(element(2n ** 3000n, "PowersOfTwo")).toBe('"True"');
  expect(element(2n ** 3000n + 1n, "PowersOfTwo")).toBe('"False"');
});
