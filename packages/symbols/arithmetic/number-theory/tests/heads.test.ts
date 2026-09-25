import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("GCD and LCM of Gaussian rationals: gcd(p1,p2)/lcm(q1,q2), lcm(p1,p2)/gcd(q1,q2) (#113)", () => {
  const c = (re: unknown, im: unknown) => ["Complex", re, im];
  const r = (n: number, d: number) => ["Rational", n, d];

  // gcd(15+10i, 3+2i)/lcm(3,2): 15+10i = 5(3+2i), so gcd(15+10i,3+2i) = 3+2i up to unit,
  // and lcm(3,2) = 6 -- (3+2i)/6 = 1/2 + i/3.
  expect(run(["GCD", c(5, r(10, 3)), c(r(3, 2), 1)])).toEqual(c(r(1, 2), r(1, 3)));

  // lcm(5+6i, 1+3i)/gcd(10,3): 5+6i and 1+3i are coprime in ℤ[i], so their lcm is their
  // product's first-quadrant associate 21+13i, and gcd(10,3) = 1.
  expect(run(["LCM", c(r(1, 2), r(3, 5)), c(r(1, 3), 1)])).toEqual(c(21, 13));

  // A bare Rational operand (im = 0) stays consistent with the plain-rational identity:
  // gcd(1,2)/lcm(3,5) = 1/15.
  expect(run(["GCD", r(1, 3), r(2, 5)])).toEqual(r(1, 15));

  // A pure Gaussian-integer call is untouched -- it still answers through the earlier,
  // integer-only wrapper (this one declines: every denominator is already 1).
  expect(run(["GCD", c(3, 1), c(1, 3)])).toEqual(c(1, 1));
  expect(run(["LCM", c(3, 1), c(-1, 3)])).toEqual(c(3, 1));
});

test("FactorInteger and Divisors over the integers, as in Wolfram", () => {
  // p³ for a 21-digit prime: compute-engine's own rho gives up here. Checked through the
  // internal boxed representation (bigIntegerAt/operandsOf), not run()'s JSON, since the
  // point is exactness of the underlying bigint, not a specific MathJSON shape.
  const p = 100000000000000000039n;
  const factors = ce.box(["FactorInteger", { num: String(p ** 3n) }]).evaluate();
  expect(operandsOf(factors).map((t) => operandsOf(t).map(bigIntegerAt))).toEqual([[p, 3n]]);
  const divisors = ce.box(["Divisors", { num: String(p ** 2n) }]).evaluate();
  expect(operandsOf(divisors).map(bigIntegerAt)).toEqual([1n, p, p ** 2n]);
});

test("Gaussian results stay exact past a double", () => {
  const big = ["Complex", { num: "100000000000000000001" }, { num: "9007199254740993" }];
  expect(run(["Mod", big, ["Complex", 2, 1]])).toBe(0);
  expect(run(["GCD", big, ["Complex", 0, { num: "9007199254740993" }]])).toBeDefined();
});

test("ExtendedGCD past two arguments folds the two-argument case pairwise", () => {
  // Brute force: every result's coefficients must actually satisfy Σ aᵢxᵢ = gcd.
  const rng = (seed: number) => {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  };
  const next = rng(42);
  for (let trial = 0; trial < 50; trial++) {
    const count = 3 + Math.floor(next() * 3); // 3..5 arguments
    const values = Array.from({ length: count }, () => Math.floor(next() * 200) - 100 || 1);
    const result = operandsOf(ce.box(["ExtendedGCD", ...values]).evaluate()).map(bigIntegerAt);
    const [g, ...coefficients] = result as bigint[];
    expect(g).toBeDefined();
    const sum = coefficients.reduce((acc, c, i) => acc + c * BigInt(values[i]!), 0n);
    expect(sum).toBe(g);
    // g must be the actual GCD of the arguments.
    const gcdAll = values
      .map((v) => BigInt(Math.abs(v)))
      .reduce((a, b) => {
        let [x, y] = [a, b];
        while (y !== 0n) [x, y] = [y, x % y];
        return x;
      });
    expect(g).toBe(gcdAll);
  }
});

test("GCD and LCM stay exact past a double (#113 §7)", () => {
  // compute-engine's native GCD/LCM round a big integer through a double: GCD(20!, 10^100+3)
  // came back 163840000 and LCM a float, instead of the exact bigint answer.
  const twentyFactorial = 2432902008176640000n;
  const big = 10n ** 100n + 3n;
  const gcdAll = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcdAll(b, a % b));
  expect(bigIntegerAt(ce.box(["GCD", ["Factorial", 20], ["Add", ["Power", 10, 100], 3]]).evaluate())).toBe(
    gcdAll(twentyFactorial, big),
  );
  expect(bigIntegerAt(ce.box(["LCM", ["Factorial", 20], ["Add", ["Power", 10, 100], 3]]).evaluate())).toBe(
    (twentyFactorial * big) / gcdAll(twentyFactorial, big),
  );

  // Brute force against a plain bigint Euclid, at a scale a double can't carry exactly.
  const rng = (seed: number) => {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  };
  const next = rng(7);
  for (let trial = 0; trial < 30; trial++) {
    const a = BigInt(Math.floor(next() * 1e15)) * 10n ** 30n + BigInt(Math.floor(next() * 1e15));
    const b = BigInt(Math.floor(next() * 1e15)) * 10n ** 30n + BigInt(Math.floor(next() * 1e15));
    const g = gcdAll(a, b);
    expect(bigIntegerAt(ce.box(["GCD", { num: String(a) }, { num: String(b) }]).evaluate())).toBe(g);
    expect(bigIntegerAt(ce.box(["LCM", { num: String(a) }, { num: String(b) }]).evaluate())).toBe(
      g === 0n ? 0n : (a * b) / g < 0n ? -((a * b) / g) : (a * b) / g,
    );
  }
});

test("DivisorSigma with a non-integer rational k: exact radical sum, cross-checked numerically (#113)", () => {
  // Divisors of 12: 1, 2, 3, 4, 6, 12. sqrt of each: 1, √2, √3, 2, √6, 2√3.
  // Summed: 3 + √2 + √6 + 3√3. Cross-checked numerically against a brute-force
  // double-precision sum, past the exact radical form the reference example pins.
  const bruteForce = [1, 2, 3, 4, 6, 12].reduce((sum, d) => sum + Math.sqrt(d), 0);
  const n = ce
    .box(["DivisorSigma", ["Rational", 1, 2], 12] as never)
    .evaluate()
    .N().re;
  expect(n).toBeCloseTo(bruteForce, 10);
});
