import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { cx } from "../src/complex.ts";
import { logGamma } from "../src/loggamma.ts";

// 67-point golden from mpmath.loggamma at 30 digits (scripts/collect-loggamma-goldens.ts,
// UPDATE_LOGGAMMA_GOLDEN=1 to regenerate): small positive reals, the neighborhoods of 1 and
// 2, negative non-integers, complex values in all four quadrants, points near a pole but off
// the axis, large |Im(z)| (past LANCZOS_IM_LIMIT, exercising the shift-to-Stirling fallback),
// and the odd-half-integer crossings the reflection branch correction is built for.
//
// lnΓ has zeros at 1 and 2, so relative error is meaningless there — judged absolute
// (against 1) instead, same shape as special-functions.test.ts's relErr.
const BOUND = 3e-15;

interface LogGammaGolden {
  re: number;
  im: number;
  label: string;
  category:
    | "small-positive"
    | "near-integer"
    | "negative"
    | "complex"
    | "near-axis"
    | "large-im"
    | "crossing"
    | "large-re";
  mpmath: [number, number];
}

const goldens: LogGammaGolden[] = JSON.parse(readFileSync(new URL("./loggamma.golden.json", import.meta.url), "utf8"));

const errorOf = (got: { re: number; im: number }, want: [number, number]): number => {
  const d = Math.max(Math.abs(got.re - want[0]), Math.abs(got.im - want[1]));
  return d / Math.max(1, Math.hypot(want[0], want[1]));
};

test(`logGamma matches mpmath.loggamma to ${BOUND.toExponential(0)} on the 67-point golden`, () => {
  const off: string[] = [];
  for (const g of goldens) {
    const err = errorOf(logGamma(cx(g.re, g.im)), g.mpmath);
    if (!(err <= BOUND)) off.push(`${g.label}: err ${err.toExponential(2)}`);
  }
  expect(off).toEqual([]);
});

test("the golden covers every category, including the reflection crossings", () => {
  const categories = new Set(goldens.map((g) => g.category));
  expect([...categories].sort()).toEqual(
    ["complex", "crossing", "large-im", "large-re", "near-axis", "near-integer", "negative", "small-positive"].sort(),
  );
});

// The reflection branch (Re(z) < ½) recurses through lnΓ(1−z) and corrects ln sin(πz)'s own
// branch with `k = sign(Im z)·⌊(Re z + ½)/2⌋` — a formula that only has something to prove
// exactly on the odd half-integers (…, −6.5, −4.5, −2.5, −0.5, …), where sin(πz) sits exactly
// on the negative real axis and its own principal log jumps by 2πi. Off by even one such
// crossing and this is off by a whole 2π in the imaginary part, not a rounding error — so
// this is checked on its own, separately from the blanket golden sweep above.
test("the reflection branch correction is exact at odd-half-integer crossings", () => {
  const crossings = goldens.filter((g) => g.category === "crossing");
  expect(crossings.length).toBeGreaterThanOrEqual(4);
  for (const g of crossings) {
    const err = errorOf(logGamma(cx(g.re, g.im)), g.mpmath);
    expect(err, g.label).toBeLessThanOrEqual(BOUND);
  }
});
