import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("RationalReconstruction", () => {
  expect(run(["RationalReconstruction", 6, 11])).toEqual(["Rational", 1, 2]);
  expect(run(["RationalReconstruction", 3, 11])).toEqual(["RationalReconstruction", 3, 11]);
});

test("Gaussian integers reach the integer heads, as in Wolfram", () => {
  const c = (re: number, im: number) => ["Complex", re, im];
  const gaussian = ["KeyValuePair", "GaussianIntegers", "True"];
  expect(run(["Mod", c(7, 5), 3])).toEqual(c(1, -1));
  expect(run(["Mod", 7, 3])).toBe(1);
  expect(run(["Quotient", c(7, 5), c(2, 1)])).toEqual(c(4, 1));
  expect(run(["Quotient", -7, 2])).toBe(-4);
  expect(run(["GCD", c(3, 1), c(1, 3)])).toEqual(c(1, 1));
  expect(run(["LCM", c(3, 1), c(-1, 3)])).toEqual(c(3, 1));
  expect(run(["ExtendedGCD", c(3, 1), 5])).toEqual(["Tuple", c(1, 2), 2, -1]);
  expect(run(["ModularInverse", c(3, -1), c(5, 2)])).toEqual(c(-1, -1));
  expect(run(["PowerMod", c(2, 1), 2, 3])).toEqual(c(0, 1));
  expect(run(["IsPrime", c(2, 1)])).toBe("True");
  expect(run(["IsPrime", 5, gaussian])).toBe("False");
  expect(run(["IsPrime", 5])).toBe("True");
  expect(run(["IsPrime", ["List", 2, 3, 4]])).toEqual(["List", "True", "True", "False"]);
  expect(run(["FactorInteger", 5, gaussian])).toEqual([
    "List",
    ["Tuple", c(0, -1), 1],
    ["Tuple", c(1, 2), 1],
    ["Tuple", c(2, 1), 1],
  ]);
  expect(run(["Divisors", 5, gaussian])).toEqual(["List", 1, c(1, 2), c(2, 1), 5]);
  expect(run(["PowerModList", c(2, 1), ["Rational", 1, 2], 5])).toEqual(["List", c(-1, 2), c(1, -2)]);
});

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
  expect(run(["FactorInteger", -12])).toEqual(["List", ["Tuple", -1, 1], ["Tuple", 2, 2], ["Tuple", 3, 1]]);
  expect(run(["FactorInteger", 1])).toEqual(["List", ["Tuple", 1, 1]]);
  expect(run(["FactorInteger", 0])).toEqual(["List", ["Tuple", 0, 1]]);
  expect(run(["Divisors", -12])).toEqual(["List", 1, 2, 3, 4, 6, 12]);
  expect(run(["Divisors", 1])).toEqual(["List", 1]);
  expect(run(["Divisors", 0])).toEqual(["Divisors", 0]);
  // p³ for a 21-digit prime: compute-engine's own rho gives up here.
  const p = 100000000000000000039n;
  const factors = ce.box(["FactorInteger", { num: String(p ** 3n) }]).evaluate();
  expect(operandsOf(factors).map((t) => operandsOf(t).map(bigIntegerAt))).toEqual([[p, 3n]]);
  const divisors = ce.box(["Divisors", { num: String(p ** 2n) }]).evaluate();
  expect(operandsOf(divisors).map(bigIntegerAt)).toEqual([1n, p, p ** 2n]);
});

test("widened integer heads still leave a non-integer alone", () => {
  expect(run(["FactorInteger", 2.5])).toEqual(["FactorInteger", 2.5]);
  expect(run(["Divisors", ["Rational", 5, 2]])).toEqual(["Divisors", ["Rational", 5, 2]]);
  expect(run(["ExtendedGCD", 2.5, 3])).toEqual(["ExtendedGCD", 2.5, 3]);
  expect(run(["ExtendedGCD", 6, 4])).toEqual(["Tuple", 2, 1, -1]);
});

test("Gaussian results stay exact past a double", () => {
  const big = ["Complex", { num: "100000000000000000001" }, { num: "9007199254740993" }];
  expect(run(["Mod", big, ["Complex", 2, 1]])).toBe(0);
  expect(run(["GCD", big, ["Complex", 0, { num: "9007199254740993" }]])).toBeDefined();
});

test("ExtendedGCD past two arguments folds the two-argument case pairwise", () => {
  expect(run(["ExtendedGCD", 6, 15, 30])).toEqual(["Tuple", 3, -2, 1, 0]);
  // Still gated to plain integers: a Gaussian third argument (declare-gaussian.ts's own
  // ExtendedGCD only widens to two) is left unevaluated, and so is a non-integer.
  expect(run(["ExtendedGCD", ["Complex", 3, 1], 5, 2])).toEqual(["ExtendedGCD", ["Complex", 3, 1], 5, 2]);
  expect(run(["ExtendedGCD", 2.5, 3, 4])).toEqual(["ExtendedGCD", 2.5, 3, 4]);

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

test("IsPrime(-n) matches Wolfram's PrimeQ: True for a negative prime's associate", () => {
  expect(run(["IsPrime", -7])).toBe("True");
  expect(run(["IsPrime", -1])).toBe("False");
  expect(run(["IsPrime", -4])).toBe("False");
  expect(run(["IsPrime", -2])).toBe("True");
  // Positive n is untouched.
  expect(run(["IsPrime", 7])).toBe("True");
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

test("GCD and LCM thread a single list argument, but keep flattening two (#113 §1)", () => {
  expect(run(["GCD", 12, ["List", 3, 7, 40]])).toEqual(["List", 3, 1, 4]);
  expect(run(["LCM", 12, ["List", 3, 7, 40]])).toEqual(["List", 12, 84, 120]);
  // Two list arguments still flatten into more arguments — the documented divergence stays.
  expect(run(["GCD", ["List", 2, 4], ["List", 6, 8]])).toBe(2);
});

test("Quotient: real, rational and offset arguments, and threading (#113 §1, §5)", () => {
  expect(run(["Quotient", 7.5, 2])).toBe(3);
  expect(run(["Quotient", ["Rational", 7, 2], ["Rational", 1, 3]])).toBe(10);
  expect(run(["Quotient", 17, 5, 3])).toBe(2);
  expect(run(["Quotient", ["List", 10, 20, 30], 7])).toEqual(["List", 1, 2, 4]);
  // Unchanged: plain and Gaussian integers.
  expect(run(["Quotient", 17, 5])).toBe(3);
  expect(run(["Quotient", ["Complex", 5, 5], 2])).toEqual(["Complex", 2, 2]);
});

test("Totient(-n) and NextPrime(-n) match Wolfram (#113 §6)", () => {
  expect(run(["Totient", -10])).toBe(4);
  expect(run(["Totient", 0])).toBe(0);
  expect(run(["NextPrime", -10])).toBe(-7);
  expect(run(["NextPrime", -2])).toBe(2);
});

test("NextPrime of a rational or real n (#113 §6)", () => {
  expect(run(["NextPrime", ["Rational", 7, 2]])).toBe(5);
  expect(run(["NextPrime", 100.5])).toBe(101);
});

test("IsSquareFree of a rational (#113 §6)", () => {
  expect(run(["IsSquareFree", ["Rational", 2, 3]])).toBe("True");
  expect(run(["IsSquareFree", ["Rational", 4, 3]])).toBe("False");
});

test("IsSquareFree of a polynomial: gcd(f, f') via D and PolynomialGCD (#113)", () => {
  // Univariate: x^2 + 6x + 6, discriminant 36-24=12 != 0, no repeated root.
  expect(run(["IsSquareFree", ["Add", ["Power", "x", 2], ["Multiply", 6, "x"], 6]])).toBe("True");
  // A genuine repeated root: (x-1)^2 = x^2 - 2x + 1.
  expect(run(["IsSquareFree", ["Add", ["Power", "x", 2], ["Multiply", -2, "x"], 1]])).toBe("False");

  // Multivariate: x^3 - x^2*y = x^2*(x - y), a repeated factor of x.
  expect(run(["IsSquareFree", ["Subtract", ["Power", "x", 3], ["Multiply", ["Power", "x", 2], "y"]]])).toBe("False");
  // x^3 - y^3 = (x-y)(x^2+xy+y^2), no repeated factor.
  expect(run(["IsSquareFree", ["Subtract", ["Power", "x", 3], ["Power", "y", 3]]])).toBe("True");

  // With an explicit variable: x*y^2 is squarefree as a polynomial in x alone (y is just
  // a coefficient), but not in y alone (y appears squared).
  expect(run(["IsSquareFree", ["Multiply", "x", ["Power", "y", 2]], "x"])).toBe("True");
  expect(run(["IsSquareFree", ["Multiply", "x", ["Power", "y", 2]], "y"])).toBe("False");
});

test("FactorInteger of a rational (#113 §6)", () => {
  expect(run(["FactorInteger", ["Rational", 3, 8]])).toEqual(["List", ["Tuple", 2, -3], ["Tuple", 3, 1]]);
  expect(run(["FactorInteger", ["Rational", -3, 8]])).toEqual([
    "List",
    ["Tuple", -1, 1],
    ["Tuple", 2, -3],
    ["Tuple", 3, 1],
  ]);
});

test("DivisorSigma with a symbolic k (#113 §4)", () => {
  expect(run(["DivisorSigma", "k", 30])).toEqual([
    "Add",
    ["Power", 2, "k"],
    ["Power", 3, "k"],
    ["Power", 5, "k"],
    ["Power", 6, "k"],
    ["Power", 10, "k"],
    ["Power", 15, "k"],
    ["Power", 30, "k"],
    1,
  ]);
});

test("DivisorSigma with a non-integer rational k: exact radical sum (#113)", () => {
  // Divisors of 12: 1, 2, 3, 4, 6, 12. sqrt of each: 1, √2, √3, 2, √6, 2√3.
  // Summed: 3 + √2 + √6 + 3√3.
  expect(run(["DivisorSigma", ["Rational", 1, 2], 12])).toEqual([
    "Add",
    3,
    ["Sqrt", 2],
    ["Sqrt", 6],
    ["Multiply", 3, ["Sqrt", 3]],
  ]);
  // Cross-check numerically against a brute-force double-precision sum.
  const bruteForce = [1, 2, 3, 4, 6, 12].reduce((sum, d) => sum + Math.sqrt(d), 0);
  const n = ce
    .box(["DivisorSigma", ["Rational", 1, 2], 12] as never)
    .evaluate()
    .N().re;
  expect(n).toBeCloseTo(bruteForce, 10);

  // An integer k is untouched: this wrapper only fires for a non-integer rational.
  expect(run(["DivisorSigma", 2, 20])).toBe(546);
});

test("threads over a list: DivisorSigma (in n), LegendreSymbol, ExtendedGCD, ModularInverse (#113 §1)", () => {
  expect(run(["DivisorSigma", 2, ["List", 1, 2, 3, 4, 5]])).toEqual(["List", 1, 5, 10, 21, 26]);
  expect(run(["LegendreSymbol", ["List", 1, 2, 3, 4, 5, 6], 7])).toEqual(["List", 1, 1, -1, 1, -1, -1]);
  expect(run(["ExtendedGCD", 3, ["List", 5, 15]])).toEqual(["List", ["Tuple", 1, 2, -1], ["Tuple", 3, 1, 0]]);
  expect(run(["ModularInverse", ["List", 2, 3, 4], 11])).toEqual(["List", 6, 4, 3]);
});

test("GaussianIntegers -> True for PrimeNu, PrimeOmega, DivisorSigma, MoebiusMu, IsSquareFree, IntegerExponent (#113 §6)", () => {
  const gaussian = ["KeyValuePair", "GaussianIntegers", "True"];
  expect(run(["PrimeNu", ["Complex", 3, 1]])).toBe(2);
  expect(run(["PrimeNu", 105, gaussian])).toBe(4);
  expect(run(["PrimeOmega", ["Complex", 5, 9]])).toBe(2);
  expect(run(["PrimeOmega", 12, gaussian])).toBe(5);
  expect(run(["MoebiusMu", ["Complex", 5, 6]])).toBe(-1);
  expect(run(["IsSquareFree", ["Complex", 3, 2]])).toBe("True");
  expect(run(["IsSquareFree", 2, gaussian])).toBe("False");
  expect(run(["DivisorSigma", 1, ["Complex", 3, 1]])).toEqual(["Complex", 6, 4]);
  expect(run(["DivisorSigma", 2, 6, gaussian])).toEqual(["Complex", 50, 20]);
  expect(run(["IntegerExponent", ["Complex", 0, 8], ["Complex", 1, 1]])).toBe(6);
  // Unchanged: rational-integer reads without the option.
  expect(run(["PrimeNu", 105])).toBe(3);
  expect(run(["IntegerExponent", 1000])).toBe(3);
});
