// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { incompleteEllipticFBig } from "../src/elliptic-pi-big.ts";
import { hypergeometric2F1RegularizedBig } from "../src/hypergeometric-big.ts";
import { qFactorialBig } from "../src/q-factorial-big.ts";
import { riemannSiegelZBig, riemannSiegelZComplexBig, riemannZetaZeroBig } from "../src/riemann-siegel-big.ts";

// 2F1Regularized past |z| = 1, EllipticF, QFactorial at a fractional n and RiemannSiegelZ /
// RiemannZetaZero, each at 50 digits against mpmath (mp.dps = 120, arguments as exact decimals or
// rationals) and, for the rows the reference pins, Wolfram. 45 digits are compared: the last few
// carry the guard.

const COMPARED = 45;
const d = (x: string | number) => new BigDecimal(x);
const third = () => d(1).div(3);
const at = <T>(digits: number, fn: () => T): T => {
  const saved = BigDecimal.precision;
  BigDecimal.precision = digits;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
};
const agrees = (ours: BigDecimal | undefined, expected: string): void => {
  expect(ours?.toPrecision(COMPARED).toString()).toBe(d(expected).toPrecision(COMPARED).toString());
};

test("Hypergeometric2F1Regularized: Pfaff past z = -1/2, the series inside, a pole of Γ(c)", () => {
  at(60, () => {
    const a = third();
    agrees(
      hypergeometric2F1RegularizedBig(a, d(1), d(3), d(-7), 50),
      "0.355102040816326530612244897959183673469387755102040816326531",
    );
    agrees(
      hypergeometric2F1RegularizedBig(d("0.5"), d("1.5"), d("2.5"), d("-0.3"), 50),
      "0.693685580282776071568870769792524328928695888538478748156737",
    );
    agrees(
      hypergeometric2F1RegularizedBig(d("0.5"), d("1.5"), d("2.5"), d("0.9"), 50),
      "1.25423366656930345024049178481082190834695262810731731201684",
    );
    // c = 0: the limit is a·b·z·2F1(a+1, b+1; 2; z), which at b = 1 is the closed form -7/48.
    agrees(
      hypergeometric2F1RegularizedBig(a, d(1), d(0), d(-7), 50),
      "-0.14583333333333333333333333333333333333333333333333",
    );
    // On or past the branch point, and a series that cannot settle in its term budget.
    expect(hypergeometric2F1RegularizedBig(a, d(1), d(3), d("1.5"), 50)).toBeUndefined();
    expect(hypergeometric2F1RegularizedBig(a, d(1), d(3), d(1), 50)).toBeUndefined();
    expect(hypergeometric2F1RegularizedBig(a, d("-2.5"), d("2.3333"), d(-1e9), 50)).toBeUndefined();
  });
});

test("EllipticF: real below the branch, complex past it, and shifted by whole periods", () => {
  at(70, () => {
    const real = (phi: BigDecimal, m: BigDecimal, expected: string) => {
      const value = incompleteEllipticFBig(phi, m, 50);
      expect(value?.im.isZero()).toBe(true);
      agrees(value?.re, expected);
    };
    real(d("0.5"), third(), "0.506847756265431109203677128745872542883984995337");
    real(d("3.5"), third(), "3.8287814812730497876757305518111577737903907822308");
    real(
      d("-1.4"),
      d("-0.6666666666666666666666666666666666666666666666667"),
      "-1.2443051859093119982552111817899909902992895549829",
    );
    // m sin²φ > 1: Wolfram's value for N[EllipticF[12/5, 3], 50], and the same past a period.
    const past = incompleteEllipticFBig(d("2.4"), d(3), 50);
    agrees(past?.re, "1.0010773804561062360796595863838358931497135904585");
    agrees(past?.im, "-1.9231661895046253531841444093352781715706878703094");
    const shifted = incompleteEllipticFBig(d("5.8"), d(5), 50);
    agrees(shifted?.re, "2.2266187101335796793610158318888469372507933451807");
    agrees(shifted?.im, "-3.8983699373899583047075960366846785356023606050936");
    // φ = π/2 at m = 1 is the pole.
    expect(incompleteEllipticFBig(BigDecimal.PI.div(2), d(1), 50)).toBeUndefined();
  });
});

test("QFactorial at a fractional n: q below 1, above 1, and q = 1", () => {
  at(70, () => {
    agrees(qFactorialBig(third(), d(6), 50), "0.78686282342168581991444876310217085765468141375297");
    agrees(qFactorialBig(d("2.5"), d("0.5"), 50), "1.9602488371078358281549318853691492275195262655813");
    agrees(qFactorialBig(d("2.5"), d(1).div(3).mul(7), 50), "8.8047268042743180614582562239342265941055759664062");
    agrees(qFactorialBig(third(), d(1), 50), "0.89297951156924921121856431365822588137622979265243");
    // A pole at negative integer n, and no real value at q ≤ 0.
    expect(qFactorialBig(d(-2), d(6), 50)).toBeUndefined();
    expect(qFactorialBig(third(), d(-2), 50)).toBeUndefined();
  });
});

test("RiemannSiegelZ: real t, a complex argument, and the zeros", () => {
  const z = riemannSiegelZBig(d("1.25"), 50);
  agrees(z, "-0.650818895379208837126984179609387325917093440350870807542653");
  agrees(riemannSiegelZBig(d(143), 50), "0.402572919401926067805340405665414140612691682211916034880942");
  // Z(100 − 1e-30 i): the imaginary part is 1e-30 of the real one and still carries all its digits.
  const w = riemannSiegelZComplexBig(d(100), d("-1e-30"), 20);
  expect(w?.re.toPrecision(20).toString()).toBe(d("2.6926970566644634749953798286850324").toPrecision(20).toString());
  expect(w?.im.toPrecision(20).toString()).toBe(
    d("-2.2244209487830922251092209582796226e-31").toPrecision(20).toString(),
  );
  agrees(riemannZetaZeroBig(14.134725141734695, 50), "14.1347251417346937904572519835624702707842571156992431756856");
  agrees(riemannZetaZeroBig(21.02203963877156, 50), "21.0220396387715549926284795938969027773343405249027817546295");
  // Beyond what the Euler–Maclaurin sum is worth, and no zero near a seed that is between two.
  expect(riemannSiegelZBig(d("1e7"), 20)).toBeUndefined();
  expect(riemannZetaZeroBig(17.5, 20)).toBeUndefined();
});

// The same through N(…, d), which is what the reference rows run.
const ce = new ComputeEngine();
declareAnalytic(ce);
const n = (expr: unknown, digits: number) => ce.box(["N", expr, digits] as never).evaluate();

test("N(…, d) reaches each kernel and boxes what it returns", () => {
  expect(n(["Hypergeometric2F1Regularized", ["Rational", 1, 3], 1, 0, -7], 25).json).toEqual({
    num: "-0.1458333333333333333333333",
  });
  expect(n(["EllipticF", ["Rational", 12, 5], 3], 30).json).toEqual([
    "Complex",
    { num: "1.00107738045610623607965958638" },
    { num: "-1.92316618950462535318414440934" },
  ]);
  expect(n(["QFactorial", ["Rational", 1, 3], 6], 30).json).toEqual({ num: "0.786862823421685819914448763102" });
  expect(n(["RiemannSiegelZ", ["Rational", 4, 3]], 20).json).toEqual({ num: "-0.62963915044348153965" });
  expect(n(["RiemannZetaZero", 2], 30).json).toEqual(["Complex", 0.5, { num: "21.0220396387715549926284795939" }]);
});

test("where a kernel declines, N(…, d) stays symbolic rather than printing a double's digits", () => {
  // Complex z, and z past the branch point, for 2F1Regularized; q < 0 for QFactorial; far t for Z.
  expect(n(["Hypergeometric2F1Regularized", 1, 1, 2, ["Complex", 0.3, 0.3]], 30).operator).toBe(
    "Hypergeometric2F1Regularized",
  );
  expect(n(["Hypergeometric2F1Regularized", 1, 1, 2, 1.5], 30).operator).toBe("Hypergeometric2F1Regularized");
  expect(n(["QFactorial", ["Rational", 1, 3], -2], 30).operator).toBe("QFactorial");
  expect(n(["RiemannSiegelZ", ["Power", 10, 6]], 20).operator).toBe("RiemannSiegelZ");
  expect(riemannSiegelZComplexBig(d(30000), d("-1e-30"), 20)).toBeUndefined();
});

test("QFactorial at a fractional n answers at a double's digits too, and stays held when exact", () => {
  expect(ce.box(["QFactorial", 0.5, 6]).N().re).toBeCloseTo(0.7674158646940274, 14);
  expect(ce.box(["QFactorial", ["Rational", 1, 3], 6]).evaluate().operator).toBe("QFactorial");
  expect(ce.box(["QFactorial", 3, 2]).evaluate().json).toBe(21);
});
