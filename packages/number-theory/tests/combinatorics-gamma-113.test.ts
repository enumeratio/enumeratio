import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareNumberTheory(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate();
const json = (expr: unknown) => run(expr).json;

// Binomial(n, n-1) -> n, for symbolic n.
test("Binomial(n, n-1) reduces to n for symbolic n", () => {
  expect(json(["Binomial", "n", ["Subtract", "n", 1]])).toEqual("n");
  expect(json(["Binomial", "m", ["Add", "m", -1]])).toEqual("m");
});

// StirlingS1/Stirling are 0 past the k > n diagonal, threaded and scalar.
test("StirlingS1 and Stirling are 0 for k > n >= 0", () => {
  expect(json(["StirlingS1", 5, 6])).toEqual(0);
  expect(json(["Stirling", 3, 5])).toEqual(0);
  expect(json(["Stirling", 0, 1])).toEqual(0);
});
test("Stirling threads over a list first argument", () => {
  expect(json(["Stirling", ["List", 2, 4, 6], 2])).toEqual(["List", 1, 7, 31]);
});

// Fibonacci/LucasL polynomials, cross-checked against the recurrence directly.
function fibPoly(n: number, x: number): number {
  let prev = 0;
  let curr = 1;
  for (let k = 2; k <= n; k++) [prev, curr] = [curr, x * curr + prev];
  return n === 0 ? prev : curr;
}
function lucasPoly(n: number, x: number): number {
  let prev = 2;
  let curr = x;
  for (let k = 2; k <= n; k++) [prev, curr] = [curr, x * curr + prev];
  return n === 0 ? prev : curr;
}
test("Fibonacci(n, x) matches the direct recurrence F_k(x) = x F_{k-1}(x) + F_{k-2}(x)", () => {
  for (const n of [0, 1, 2, 5, 8]) {
    for (const x of [0, 1, 2, -3]) {
      expect(run(["Fibonacci", n, x]).re, `F_${n}(${x})`).toEqual(fibPoly(n, x));
    }
  }
});
test("LucasL(n, x) matches the direct recurrence L_k(x) = x L_{k-1}(x) + L_{k-2}(x)", () => {
  for (const n of [0, 1, 2, 5, 8]) {
    for (const x of [0, 1, 2, -3]) {
      expect(run(["LucasL", n, x]).re, `L_${n}(${x})`).toEqual(lucasPoly(n, x));
    }
  }
});
test("Fibonacci(n, 1) is the plain Fibonacci number", () => {
  for (const n of [0, 1, 2, 5, 10]) {
    expect(run(["Fibonacci", n, 1]).re).toEqual(run(["Fibonacci", n]).re);
  }
});
test("LucasL(n, 1) is the plain Lucas number", () => {
  for (const n of [0, 1, 2, 5, 10]) {
    expect(run(["LucasL", n, 1]).re).toEqual(run(["LucasL", n]).re);
  }
});

// BellNumber(n, x): the Bell/Touchard polynomial, cross-checked against sum_k S(n,k) x^k.
test("BellNumber(n, x) matches sum_k Stirling(n, k) x^k", () => {
  for (const n of [0, 1, 3, 5]) {
    for (const x of [0, 1, 2]) {
      let expected = 0;
      for (let k = 0; k <= n; k++) expected += run(["Stirling", n, k]).re! * x ** k;
      expect(run(["BellNumber", n, x]).re, `B_${n}(${x})`).toEqual(expected);
    }
  }
});
test("BellNumber(n, 1) is the plain Bell number", () => {
  for (const n of [0, 1, 3, 5, 10]) {
    expect(run(["BellNumber", n, 1]).re).toEqual(run(["BellNumber", n]).re);
  }
});

// Fibonacci/LucasL at a real index, via Binet -- cross-checked against a direct Binet
// computation in plain JS.
test("Fibonacci(nu) at a real index matches Binet's formula computed independently", () => {
  const phi = (1 + Math.sqrt(5)) / 2;
  for (const nu of [1.5, 2.75, -0.5]) {
    const expected = (phi ** nu - Math.cos(Math.PI * nu) * phi ** -nu) / Math.sqrt(5);
    expect(run(["Fibonacci", nu]).re).toBeCloseTo(expected, 9);
  }
});
test("LucasL(nu) at a real index matches Binet's formula computed independently", () => {
  const phi = (1 + Math.sqrt(5)) / 2;
  for (const nu of [1.5, 2.75, -0.5]) {
    const expected = phi ** nu + Math.cos(Math.PI * nu) * phi ** -nu;
    expect(run(["LucasL", nu]).re).toBeCloseTo(expected, 9);
  }
});

// Binomial/CatalanNumber/Subfactorial/Factorial2/Multinomial/Pochhammer through Gamma:
// cross-checked against JS's own Gamma-free forms where an independent check is cheap.
test("Binomial with an integer k stays exact for a Gaussian-integer n", () => {
  // Binomial(1+i, 5) = (1+i)*i*(i-1)*(i-2)*(i-3)/5! -- the plain falling-factorial product.
  const n = { re: 1, im: 1 };
  const terms = [0, 1, 2, 3, 4].map((k) => ({ re: n.re - k, im: n.im }));
  let acc = { re: 1, im: 0 };
  for (const t of terms) {
    acc = { re: acc.re * t.re - acc.im * t.im, im: acc.re * t.im + acc.im * t.re };
  }
  const expected = { re: acc.re / 120, im: acc.im / 120 };
  const got = run(["Binomial", ["Complex", 1, 1], 5]);
  expect(got.re).toBeCloseTo(expected.re, 9);
  expect(got.im).toBeCloseTo(expected.im, 9);
});
test("CatalanNumber(n) for a real n matches Gamma(2n+1)/(Gamma(n+1)Gamma(n+2)) via N()", () => {
  const n = 2.3;
  const expected = ce
    .box([
      "Divide",
      ["Gamma", ["Add", ["Multiply", 2, n], 1]],
      ["Multiply", ["Gamma", ["Add", n, 1]], ["Gamma", ["Add", n, 2]]],
    ])
    .N().re;
  expect(run(["CatalanNumber", n]).re).toBeCloseTo(expected!, 9);
});
test("Multinomial through Gamma reduces to Binomial's Gamma form at two real parts", () => {
  const a = 2.5;
  const b = 1.5;
  expect(run(["Multinomial", a, b]).re).toBeCloseTo(run(["Binomial", a + b, a]).re!, 6);
});

// #113 §7 follow-up: Binomial(n, n) -> 1, Multinomial() -> 1, and Pochhammer at a
// rational order through Gamma, exactly.
test("Binomial(n, n) is 1 for symbolic n", () => {
  expect(json(["Binomial", "n", "n"])).toEqual(1);
  expect(json(["Binomial", "m", "m"])).toEqual(1);
});
test("Binomial(5, 5) still answers the plain integer case", () => {
  expect(json(["Binomial", 5, 5])).toEqual(1);
});
test("Multinomial() is the empty product, 1", () => {
  expect(json(["Multinomial"])).toEqual(1);
});
test("Multinomial(n) with one argument is still 1", () => {
  expect(json(["Multinomial", 5])).toEqual(1);
  expect(json(["Multinomial", "n"])).toEqual(1);
});
test("Pochhammer at a rational order routes through Gamma via evaluate, not N", () => {
  // (3/2)_(1/2) = Gamma(2)/Gamma(3/2), left as the Gamma ratio here -- this file
  // declares only @enumeratio/number-theory, and the ratio's further exact reduction to
  // 2/sqrt(pi) is @enumeratio/analytic's Gamma simplification (see the full reference
  // engine's equivalent example, which pins that exact form end to end). The point this
  // test pins is narrower: the call reaches `.evaluate()`, not `.N()` -- so it stays
  // exact wherever the engine CAN simplify it further, instead of a decimal.
  expect(json(["Pochhammer", ["Rational", 3, 2], ["Rational", 1, 2]])).toEqual([
    "Divide",
    ["Gamma", 2],
    ["Gamma", ["Rational", 3, 2]],
  ]);
});
test("Pochhammer at a rational order matches the direct Gamma ratio numerically", () => {
  for (const [a, n] of [
    [1.5, 0.5],
    [2.5, 1.5],
    [3, 0.5],
  ] as const) {
    const expected = ce.box(["Divide", ["Gamma", ["Add", a, n]], ["Gamma", a]]).N().re;
    expect(run(["Pochhammer", a, n]).N().re).toBeCloseTo(expected!, 9);
  }
});
test("Pochhammer with a nonnegative integer order is untouched (falling-factorial product)", () => {
  expect(json(["Pochhammer", ["Rational", 1, 2], 3])).toEqual(["Rational", 15, 8]);
});

// Fibonacci(nu, x) at a real order and real argument: the two-variable Binet formula,
// cross-checked against the direct root computation and against the plain Binet formula
// (Fibonacci(nu)) at x = 1.
function fibonacciBinetX(nu: number, x: number): number {
  const disc = Math.sqrt(x * x + 4);
  const r = (x + disc) / 2;
  return (r ** nu - Math.cos(Math.PI * nu) * r ** -nu) / disc;
}
test("Fibonacci(nu, x) at a real order and argument matches the two-variable Binet formula", () => {
  for (const nu of [1.5, 5.8, -2.25]) {
    for (const x of [1, 2, 3, -0.5]) {
      expect(run(["Fibonacci", nu, x]).re, `F_${nu}(${x})`).toBeCloseTo(fibonacciBinetX(nu, x), 6);
    }
  }
});
test("Fibonacci(nu, 1) at a real order matches the plain Binet formula Fibonacci(nu)", () => {
  for (const nu of [1.5, 2.75, 5.8]) {
    expect(run(["Fibonacci", nu, 1]).re).toBeCloseTo(run(["Fibonacci", nu]).re!, 6);
  }
});
test("Fibonacci(n, x) with a nonnegative integer order still uses the exact recurrence", () => {
  expect(json(["Fibonacci", 7, "x"])).toEqual([
    "Add",
    ["Power", "x", 6],
    ["Multiply", 5, ["Power", "x", 4]],
    ["Multiply", 6, ["Power", "x", 2]],
    1,
  ]);
});
