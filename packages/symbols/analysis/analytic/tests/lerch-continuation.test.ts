import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { type Cx, cx } from "../src/complex.ts";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { lerchContinued } from "../src/lerch-continuation.ts";

// LerchPhi past |z| = 1, via the Hermite-type integral in lerch-continuation.ts. Golden
// values are mpmath.lerchphi at 30 digits (tests/lerch-continuation.golden.json); mpmath and
// Wolfram's LerchPhi agree on the principal branch (see the branch-cut test below), so these
// also stand in for Wolfram.

const ce = new ComputeEngine();
declareAnalytic(ce);

/** compute-engine's own upper incomplete Γ, the same bridge hurwitz-zeta.ts uses. */
const upperGamma = (sigma: Cx, x: Cx): Cx | undefined => {
  const v = ce.box(["Gamma", ["Complex", sigma.re, sigma.im], ["Complex", x.re, x.im]]).N();
  return Number.isFinite(v.re) && Number.isFinite(v.im) ? { re: v.re, im: v.im } : undefined;
};

interface Golden {
  label: string;
  z: [number, number];
  s: [number, number];
  a: [number, number];
  mpmath: [number, number];
}

const GOLDEN: readonly Golden[] = JSON.parse(
  readFileSync(new URL("./lerch-continuation.golden.json", import.meta.url), "utf8"),
);

for (const { label, z, s, a, mpmath } of GOLDEN) {
  test(`lerchContinued: ${label}`, () => {
    const out = lerchContinued(cx(...z), cx(...s), cx(...a), upperGamma);
    expect(out).not.toBeUndefined();
    expect(out!.re).toBeCloseTo(mpmath[0], 9);
    expect(out!.im).toBeCloseTo(mpmath[1], 9);
  });

  test(`LerchPhi(N): ${label}`, () => {
    const r = ce.box(["N", ["LerchPhi", ["Complex", ...z], ["Complex", ...s], ["Complex", ...a]]]).evaluate();
    expect(r.re).toBeCloseTo(mpmath[0], 9);
    expect((r.im ?? 0) as number).toBeCloseTo(mpmath[1], 9);
  });
}

// LerchPhi(0.5, 2, 3.5): an inexact argument (0.5, 3.5 are floats) should evaluate
// numerically without an explicit N(), the same convention HurwitzZeta and Zeta already
// follow through `wantsNumber` (see box.ts) — a float operand means a float answer.
test("inexact arguments evaluate without N()", () => {
  const r = ce.box(["LerchPhi", 0.5, 2, 3.5]).evaluate();
  expect(r.re).toBeCloseTo(0.11938622686982047, 12);
});

// s = 1, a a positive integer: Φ(z, 1, a) reduces to −ln(1−z)/z minus the finite sum of the
// first (a−1) terms, i.e. Φ(z,1,a) = (−ln(1−z) − Σ_{k=1}^{a−1} zᵏ/k) / z^a · z^(a-1)... in the
// simplest closed form used at a = 2: Φ(z,1,2) = (−ln(1−z) − z)/z². Checked against the
// general Hermite-integral continuation itself, at several z outside the disk (real,
// negative real, and complex), and against the reference's own worked example at z = 7.5.
function phiS1A2Closed(z: Cx): Cx {
  // On the real axis past the cut (z.im exactly 0, z.re > 1), take the side approached from
  // below, as lerchContinued does: 1 − z sits at −0i's negation, +0i, not −0i.
  const negIm = z.im === 0 && z.re > 1 ? 0 : -z.im;
  const oneMinusZ = cx(1 - z.re, negIm);
  const logAbs = 0.5 * Math.log(oneMinusZ.re * oneMinusZ.re + oneMinusZ.im * oneMinusZ.im);
  const theta = Math.atan2(oneMinusZ.im, oneMinusZ.re);
  const logRe = -logAbs;
  const logIm = -theta;
  const numRe = logRe - z.re;
  const numIm = logIm - z.im;
  const z2re = z.re * z.re - z.im * z.im;
  const z2im = 2 * z.re * z.im;
  const denom = z2re * z2re + z2im * z2im;
  return cx((numRe * z2re + numIm * z2im) / denom, (numIm * z2re - numRe * z2im) / denom);
}

for (const z of [cx(7.5, 0), cx(-4, 0), cx(3, 2), cx(-2, -3)] as const) {
  test(`s=1 closed form matches the general continuation at z=${z.re}+${z.im}i`, () => {
    const closed = phiS1A2Closed(z);
    const continued = lerchContinued(z, cx(1, 0), cx(2, 0), upperGamma);
    expect(continued).not.toBeUndefined();
    expect(continued!.re).toBeCloseTo(closed.re, 9);
    expect(continued!.im).toBeCloseTo(closed.im, 9);
  });
}

// Branch cut: on the cut (real z > 1) mpmath and Wolfram take the side approached from
// below (z − i0); approaching from above must NOT match, only from below does.
test("branch cut: on the cut matches the side approached from below", () => {
  const onCut = lerchContinued(cx(3, 0), cx(2, 0), cx(2, 0), upperGamma)!;
  const fromBelow = lerchContinued(cx(3, -1e-8), cx(2, 0), cx(2, 0), upperGamma)!;
  const fromAbove = lerchContinued(cx(3, 1e-8), cx(2, 0), cx(2, 0), upperGamma)!;
  expect(Math.hypot(onCut.re - fromBelow.re, onCut.im - fromBelow.im)).toBeLessThan(1e-6);
  expect(Math.hypot(onCut.re - fromAbove.re, onCut.im - fromAbove.im)).toBeGreaterThan(1e-3);
  // mpmath.lerchphi(3, 2, 2) below the cut: -0.0755355085... - 0.3834880328...i
  expect(onCut.re).toBeCloseTo(-0.07553550852076684, 8);
  expect(onCut.im).toBeCloseTo(-0.3834880328025781, 8);
});

// Where the terms cancel far below double precision (Φ(10,10,10) ≈ 4e−11 built from terms
// of order 1), the continuation declines rather than guess — through the full LerchPhi head.
test("declines rather than guess where the continuation's terms cancel", () => {
  const r = ce.box(["N", ["LerchPhi", 10, 10, 10]]).evaluate();
  expect(r.operator).toBe("LerchPhi");
});
