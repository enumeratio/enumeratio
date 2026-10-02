import { BigDecimal } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { exact, stieltjesGammaBall } from "../src/index.ts";

// γ_n(a) where it is small (near a zero in a): the first pass stops relative to the large
// partial sum, so the radius used to be looser than the digits claimed -- at 30 digits,
// relative radii of 1e-29..1e-27 for |γ| near 1e-10. The kernel now retries from the size of
// the first result and declines unless radius <= |value| * 10^-(digits + 1).
// Reference values: mpmath.stieltjes(n, a), 60 digits.
const SMALL: readonly [number, string, string][] = [
  [1, "1.14198898", "-5.08262309232010857363698368049928897551653521e-10"],
  [2, "1.35774342", "-1.87427529954576444626873122748508356631529492e-10"],
  [3, "1.5540467", "1.25248449085990071094399757995301978784500267e-10"],
  [4, "1.22041416", "4.36515177977760317454099198482206202946057489e-11"],
  [3, "2.0535589", "-8.27084578135277193878582765207231008413102173e-13"],
];

const DIGITS = 30;

test.each(SMALL)("γ_%i(%s) is right to the digits asked, with an honest radius", (n, a, expected) => {
  BigDecimal.precision = DIGITS + 30;
  const truth = new BigDecimal(expected);
  const ball = stieltjesGammaBall(n, exact(new BigDecimal(a)), DIGITS);
  // Declining is allowed; a wrong or over-claimed answer is not.
  if (ball === undefined) return;
  const limit = ball.mid.abs().mul(new BigDecimal(`1e-${DIGITS + 1}`));
  expect(ball.rad.lte(limit)).toBe(true);
  expect(ball.mid.sub(truth).abs().lte(ball.rad)).toBe(true);
  expect(
    ball.mid
      .sub(truth)
      .abs()
      .lte(truth.abs().mul(new BigDecimal(`1e-${DIGITS}`))),
  ).toBe(true);
});

test("a small value is answered, not declined", () => {
  BigDecimal.precision = DIGITS + 30;
  expect(stieltjesGammaBall(3, exact(new BigDecimal("1.5540467")), DIGITS)).toBeDefined();
});
