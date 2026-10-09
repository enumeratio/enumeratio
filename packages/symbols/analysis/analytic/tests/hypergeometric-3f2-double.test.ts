import { atDigits } from "@enumeratio/ce-patches";
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable"; // unstable: the same engine the other analytic tests use
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { hypergeometric2F1RegularizedBig } from "../src/hypergeometric-big.ts";

// Hypergeometric3F2Regularized at a double's digits: the claim pr118-hypergeometric
// (review-claims.tsv). mpmath: 0.2543049729547402391 (the committed oracle value, from
// hyp3f2-by-series with rgamma per term; the pole of Γ at the lower parameter −1 is in play).

const ce = new ComputeEngine();
declareAnalytic(ce);

const MPMATH = 0.25430497295474025; // 0.2543049729547402391 rounded to the nearest double
const ULP = 2 ** -54; // spacing of doubles in [0.25, 0.5)
const e = ce.box(["Hypergeometric3F2Regularized", 1, 2, 3, 4, -1, ["Rational", 1, 3]]);

test("N() and N(x, d) agree with mpmath to 1 ulp at a lower parameter of −1", () => {
  // The operands convert at the engine's precision (21 digits on a plain N()), well under an ulp.
  expect(Math.abs((e.N().re as number) - MPMATH)).toBeLessThanOrEqual(ULP);
  const at17 = ce.box(["N", e.json, 17]).evaluate();
  expect(Math.abs(Number(at17.re) - MPMATH)).toBeLessThanOrEqual(ULP);
  const at20 = ce.box(["N", e.json, 20]).evaluate();
  expect(String((at20.json as { num: string }).num).slice(0, 19)).toBe("0.25430497295474023");
});

test("evaluate() without N leaves the exact expression alone", () => {
  expect(e.evaluate().operator).toBe("Hypergeometric3F2Regularized");
});

// 2F1(1, 1; 2; z) = −ln(1 − z)/z and Γ(2) = 1, so the regularized value is known in closed form at
// any z in the disc; its term ratio (k + 1)z/(k + 2) climbs toward z, the p = q + 1 shape (DLMF 16.2)
// whose tail a bound from the ratios seen so far understates.
const DIGITS = 40;
const closedForm = (z: BigDecimal): BigDecimal =>
  atDigits(DIGITS + 10, () => new BigDecimal(1).sub(z).ln().neg().div(z));

test.each(["0.5", "0.9"])("2F1(1, 1; 2; %s) settles to all 40 digits against −ln(1 − z)/z", (text) => {
  const z = new BigDecimal(text);
  const got = hypergeometric2F1RegularizedBig(new BigDecimal(1), new BigDecimal(1), new BigDecimal(2), z, DIGITS);
  expect(got).toBeDefined();
  const want = closedForm(z);
  const error = atDigits(DIGITS + 10, () => got!.sub(want).abs().div(want).toNumber());
  expect(error).toBeLessThan(10 ** -(DIGITS - 1));
});

test("a complex 2F1 answers to a double against −ln(1 − z)/z", () => {
  // −ln(1 − z)/z at z = 0.5 + 0.5i, in doubles.
  const [x, y] = [0.5, 0.5];
  const [wr, wi] = [1 - x, -y];
  const [lr, li] = [Math.log(Math.hypot(wr, wi)), Math.atan2(wi, wr)];
  const [nr, ni] = [-lr, -li];
  const d = x * x + y * y;
  const want = [(nr * x + ni * y) / d, (ni * x - nr * y) / d];
  const near = ce.box(["Hypergeometric2F1Regularized", 1, 1, 2, ["Complex", x, y]]).N();
  expect(Math.abs((near.re as number) - want[0]!)).toBeLessThan(1e-14);
  expect(Math.abs((near.im as number) - want[1]!)).toBeLessThan(1e-14);
});

test("the double series at z = 0.9 with a large lower parameter matches a 6000-term sum", () => {
  // 2F1(1, 1; 100; 0.9)/Γ(100): early terms shrink by ratios far under z, then the ratio climbs to
  // 0.9. The value is a 6000-term sum of the series at 80 digits.
  const want = 1.0813304623840039e-156;
  const got = ce.box(["Hypergeometric2F1Regularized", 1, 1, 100, 0.9]).N().re as number;
  expect(Math.abs(got - want) / want).toBeLessThan(2e-15);
});

test("the double series declines on a complex z whose terms cannot settle in its budget", () => {
  // |z| = 0.99 needs far more than the double series' 500 terms.
  const rim = ce.box(["Hypergeometric3F2Regularized", 1, 2, 3, 4, 5, ["Complex", 0.7, 0.7]]);
  expect(rim.N().operator).toBe("Hypergeometric3F2Regularized");
});

test("a series that cannot settle in the bignum term budget declines rather than answering", () => {
  // Runs the bignum kernel to its 20,000-term cap at 40 working digits (~285 ms on the dev box).
  const rim = ce.box(["Hypergeometric3F2Regularized", 1, 2, 3, 4, 5, 0.999]);
  expect(rim.N().operator).toBe("Hypergeometric3F2Regularized");
});
