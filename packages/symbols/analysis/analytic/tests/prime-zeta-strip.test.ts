// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// PrimeZetaP for 0 < Re(s) < 1. Wolfram continues the Möbius/ζ identity with a particular
// branch of each ln ζ(ks); the values below are wolframscript 15.0.0's `N[PrimeZetaP[s], 30]`.

const ce = new ComputeEngine();
declareAnalytic(ce);

const rat = (a: number, b: number) => ["Rational", a, b];
const at = (re: unknown, im: number) => ["Add", re, ["Multiply", im, "ImaginaryUnit"]];

const value = (s: unknown) => ce.box(["PrimeZetaP", s as never]).N();
const digits = (s: unknown, d: number) => ce.box(["N", ["PrimeZetaP", s as never], d]).evaluate();

/** Within a double kernel's accuracy of Wolfram's value. */
const expectValue = (s: unknown, re: number, im: number) => {
  const v = value(s);
  expect(v.re).toBeCloseTo(re, 11);
  expect(v.im).toBeCloseTo(im, 11);
};

test("real s: the principal log, +iπ from every ζ(ks) on the negative reals", () => {
  expectValue(rat(3, 10), -1.328034068791349, Math.PI / 6);
  expectValue(rat(9, 10), 1.838831615444687, Math.PI);
  expectValue(rat(4, 11), -1.435100337745163, Math.PI / 2);
  // μ(4) = 0: 1/4 is not a pole
  expectValue(rat(1, 4), -1.041610680175726, Math.PI / 6);
});

test("complex s with Re(s) ≥ 1/2 takes the principal Log of ζ(s)", () => {
  expectValue(at(rat(1, 2), 1), -0.001325962929583059, -1.063630170247807);
  expectValue(at(rat(7, 10), 1), 0.06888946871120064, -0.9834731268187046);
  expectValue(at(rat(9, 10), 30), -0.3458961987129352, -1.07692919853777);
  expectValue(at(rat(3, 5), -3), -0.5664420977230348, 0.3262472822923572);
});

test("complex s with Re(s) < 1/2 takes the functional-equation branch, 2πi off the principal one", () => {
  // principal Im is -0.8626
  expectValue(at(rat(3, 10), 2), -0.4699452934018859, 5.42061262186101);
  // principal Im is -1.1397
  expectValue(at(rat(1, 5), 0.5), -0.01730767838091842, 2.001909067197963);
  // Re(5s) = 1/2 exactly is still principal
  expectValue(at(rat(1, 10), 1), -0.1568404798736127, -0.08188835221971687);
  expectValue(at(rat(1, 6), 1), -0.096976280044467, 1.984855760566243);
});

test("P(conj s) = conj P(s)", () => {
  const [a, b] = [value(at(rat(3, 10), 2)), value(at(rat(3, 10), -2))];
  expect(b.re).toBeCloseTo(a.re, 14);
  expect(b.im).toBeCloseTo(-a.im, 12);
});

test("ComplexInfinity at s = 1/k for squarefree k, as Wolfram", () => {
  for (const s of [1, rat(1, 2), rat(1, 6), 0.5])
    expect(ce.box(["PrimeZetaP", s as never]).evaluate().json).toBe("ComplexInfinity");
});

test("declines at Re(s) ≤ 0, near a zero of ζ(ks), and past the cost cap", () => {
  for (const s of [0, -1, at(-0.5, 1), rat(1, 1000), at(0.5, 14.134725)]) expect(value(s).operator).toBe("PrimeZetaP");
});

test("N(x, d) to Wolfram's digits, real and complex", () => {
  const real = digits(rat(4, 11), 50);
  expect(real.re).toBeCloseTo(-1.4351003377451634, 14);
  expect(real.im).toBeCloseTo(Math.PI / 2, 14);
  expect(real.bignumRe?.toString().slice(0, 45)).toBe(
    "-1.43510033774516343371085272777638955823443091038481".slice(0, 45),
  );
  expect(real.bignumIm?.toString().slice(0, 45)).toBe(
    "1.5707963267948966192313216916397514420985846996876".slice(0, 45),
  );
  const complex = digits(at(rat(7, 10), 1), 30);
  expect(complex.bignumRe?.toString().slice(0, 26)).toBe("0.0688894687112006415147950768140694388".slice(0, 26));
  expect(complex.bignumIm?.toString().slice(0, 26)).toBe("-0.98347312681870465042125966".slice(0, 26));
});

test("N(x, d) declines at an approximated pole, and where the terms would take too long", () => {
  // 6s = 1 to within the digits asked for: the rounding of an exact pole, not a value
  expect(digits(rat(1, 6), 50).operator).toBe("PrimeZetaP");
  // Re(s) = 1/10 needs thousands of terms at 50 digits
  expect(digits(at(rat(1, 10), 1), 50).operator).toBe("PrimeZetaP");
});
