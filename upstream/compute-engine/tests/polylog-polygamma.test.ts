import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches, polygammaReal, polyLog, polyLogReal, polygamma, setZetaKernel } from "../src/index.ts";

// PolyLog and PolyGamma are native compute-engine heads. applyAllPatches extends
// rather than replaces them, so these tests cover both halves: the native cases must
// keep working untouched, and the cases it declines (non-integer/complex order for
// PolyLog, complex argument for PolyGamma — digamma (m = 0) included) must now evaluate.

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

  test("cancellation region: PolyGamma stays unevaluated (not ComplexInfinity) with the double kernel forced", () => {
    try {
      setZetaKernel("double");
      const r = ce.box(["PolyGamma", 8, ce.complex(CANCELLING_Z.re, CANCELLING_Z.im)]).N();
      expect(r.operator).toBe("PolyGamma"); // declined, not ComplexInfinity
    } finally {
      setZetaKernel("bignum");
    }
  });
});

describe("COMPILE HANDLERS", () => {
  test("PolyLog compiles to our kernel on both targets and runs", () => {
    const js = new JavaScriptTarget().compile(ce.box(["PolyLog", 2, "z"])) as {
      code?: string;
      run?: (s: Record<string, unknown>) => unknown;
    };
    expect(js.code).toContain("__pl(");
    const wgsl = new WGSLTarget().compile(ce.box(["PolyLog", 2, "z"])) as { code?: string };
    expect(wgsl.code).toContain("polyLog(vec2f");
    expect(wgsl.code).toContain(").x");
    // oxlint-disable-next-line no-implied-eval -- running compute-engine-compiled source is the point
    const g = new Function("_", `return (${js.code});`) as (s: Record<string, unknown>) => number;
    expect(Math.abs(g({ z: 0.5, __pl: polyLogReal }) - polyLogReal(2, 0.5))).toBeLessThan(1e-12);
  });

  test("PolyGamma gets a WGSL kernel; JS keeps compute-engine's own lowering", () => {
    const js = new JavaScriptTarget().compile(ce.box(["PolyGamma", 1, "x"])) as {
      code?: string;
      run?: (s: Record<string, unknown>) => unknown;
    };
    expect(js.code).toContain("polygamma(1"); // _SYS.polygamma — native, not ours
    expect(js.code).not.toContain("_.__"); // no scope wrapper needed on this target
    expect(Math.abs((js.run?.({ x: 1 }) as number) - polygammaReal(1, 1))).toBeLessThan(1e-12);
    const wgsl = new WGSLTarget().compile(ce.box(["PolyGamma", 1, "x"])) as { code?: string };
    expect(wgsl.code).toContain("polygamma(vec2f");
  });
});
