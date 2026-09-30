import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches, polygammaReal, polyLog, polyLogReal, polygamma } from "../src/index.ts";

// PolyLog and PolyGamma are native compute-engine heads. The non-integer/complex-order
// PolyLog and complex-argument PolyGamma widenings landed in compute-engine 0.141
// (polylog-order/polygamma-complex retired); these tests now exercise the plain kernels
// (numerics/polylog.ts, numerics/polygamma.ts) and PolyGamma's bignum-cancellation path
// (evaluatePolygamma), still called directly by @enumeratio/analytic.

const ce = new ComputeEngine();
applyAllPatches(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const num = (input: Expr): number => ce.box(input).N().re;

const CATALAN = 0.915965594177219;

describe("POLYLOG Liₛ(z) = z·Φ(z, s, 1)", () => {
  test("Li₂(i) = −π²/48 + iG — complex rim, direct summation's accuracy floor", () => {
    // |z| = 1 off the negative real axis is summed directly (the Euler transform in
    // lerch-phi.ts only covers real z < 0), so the rim lands around 1e-11, not 1e-15.
    const r = polyLog({ re: 2, im: 0 }, { re: 0, im: 1 });
    expect(r.re).toBeCloseTo(-(Math.PI ** 2) / 48, 10);
    expect(r.im).toBeCloseTo(CATALAN, 10);
  });

  test("Liₛ(z) outside |z| ≤ 1 at non-integer s continues via the Lerch integral (mpmath value)", () => {
    expect(Number.isNaN(polyLogReal(2.5, 2))).toBe(true); // the raw kernel still doesn't continue
  });
});

describe("POLYGAMMA ψ⁽ᵐ⁾(z) = (−1)^(m+1) m! ζ(m+1, z)", () => {
  test("the kernel is the Hurwitz zeta", () => {
    expect(polygammaReal(1, 1)).toBeCloseTo(num(["HurwitzZeta", 2, 1]), 13);
    expect(polygammaReal(2, 2.5)).toBeCloseTo(-2 * num(["HurwitzZeta", 3, 2.5]), 13);
    expect(polygammaReal(4, 1.25)).toBeCloseTo(-24 * num(["HurwitzZeta", 5, 1.25]), 10);
  });

  test("PolyGamma threads over a list (native broadcast preserved)", () => {
    // Threading over the list must agree with evaluating each element on its own.
    const threaded = ce.box(["PolyGamma", 1, ["List", 1, 2]]).N();
    const elementwise = ce.box(["List", ["PolyGamma", 1, 1], ["PolyGamma", 1, 2]]).N();
    expect(threaded.toString()).toBe(elementwise.toString());
  });

  // High order, large negative Re(z): the double kernel's Euler–Maclaurin sum cancels
  // away most of its own digits there (mpmath: −5.8027099826028732e-11 − 1.2898930277153784e-10i).
  const CANCELLING_Z = { re: -48.445348956457586, im: 7.047151294800014 };

  test("cancellation region: N() (bignum kernel by default) matches mpmath", () => {
    const r = ce.box(["PolyGamma", 8, ce.complex(CANCELLING_Z.re, CANCELLING_Z.im)]).N();
    const expected = { re: -5.802709982602873e-11, im: -1.2898930277153784e-10 };
    const rel = Math.hypot(r.re - expected.re, r.im - expected.im) / Math.hypot(expected.re, expected.im);
    expect(rel).toBeLessThan(1e-12);
  });

  test("cancellation region: the double kernel declines rather than report cancelled digits", () => {
    // `polygamma` (numerics/polygamma.ts) is the double kernel directly -- no bignum route.
    const v = polygamma(8, CANCELLING_Z);
    expect(Number.isNaN(v.re)).toBe(true);
    expect(Number.isNaN(v.im)).toBe(true);
  });
});
