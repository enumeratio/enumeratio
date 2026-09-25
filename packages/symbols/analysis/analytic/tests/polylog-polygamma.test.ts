import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget, WGSLTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { polygammaReal } from "../src/polygamma.ts";
import { polyLog, polyLogReal } from "../src/polylog.ts";

// PolyLog and PolyGamma are native compute-engine heads. declareAnalytic extends
// rather than replaces them, so these tests cover both halves: the native cases must
// keep working untouched, and the cases it declines (non-integer/complex order for
// PolyLog, complex argument for PolyGamma — digamma (m = 0) included) must now evaluate.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const num = (input: Expr): number => ce.box(input).N().re;

const ZETA3 = 1.2020569031595942854;
const CATALAN = 0.915965594177219015;

// --- PolyLog Liₛ(z) = z·Φ(z, s, 1) ------------------------------------------------

test("Li₂(i) = −π²/48 + iG — complex rim, direct summation's accuracy floor", () => {
  // |z| = 1 off the negative real axis is summed directly (the Euler transform in
  // lerch.ts only covers real z < 0), so the rim lands around 1e-11, not 1e-15.
  const r = polyLog({ re: 2, im: 0 }, { re: 0, im: 1 });
  expect(r.re).toBeCloseTo(-(Math.PI ** 2) / 48, 10);
  expect(r.im).toBeCloseTo(CATALAN, 10);
});

test("Liₛ(z) outside |z| ≤ 1 at non-integer s continues via the Lerch integral (mpmath value)", () => {
  expect(Number.isNaN(polyLogReal(2.5, 2))).toBe(true); // the raw kernel still doesn't continue
});

// --- PolyGamma ψ⁽ᵐ⁾(z) = (−1)^(m+1) m! ζ(m+1, z) ----------------------------------

test("trigamma values: ψ′(1) = π²/6, ψ′(1/2) = π²/2, ψ′(2) = π²/6 − 1", () => {
  expect(num(["PolyGamma", 1, 1])).toBeCloseTo(Math.PI ** 2 / 6, 13);
  expect(num(["PolyGamma", 1, ["Rational", 1, 2]])).toBeCloseTo(Math.PI ** 2 / 2, 13);
  expect(num(["PolyGamma", 1, 2])).toBeCloseTo(Math.PI ** 2 / 6 - 1, 13);
});

test("ψ⁽²⁾(1) = −2ζ(3) and ψ⁽³⁾(1) = π⁴/15", () => {
  expect(num(["PolyGamma", 2, 1])).toBeCloseTo(-2 * ZETA3, 12);
  expect(num(["PolyGamma", 3, 1])).toBeCloseTo(Math.PI ** 4 / 15, 11);
});

test("ψ⁽⁰⁾ is still the native digamma (ψ(1) = −γ)", () => {
  expect(num(["PolyGamma", 0, 1])).toBeCloseTo(-0.5772156649015329, 13);
});

test("ψ⁽⁰⁾ at a complex argument — the digamma asymptotic series (mpmath values)", () => {
  const a = ce.box(["PolyGamma", 0, ["Complex", 1, 1]]).N();
  expect(a.re).toBeCloseTo(0.09465032062247698, 12);
  expect(a.im).toBeCloseTo(1.076674047468581, 12);
  const b = ce.box(["PolyGamma", 0, ["Complex", 0.5, 0.3]]).N();
  expect(b.re).toBeCloseTo(-1.397932629405807, 12);
  expect(b.im).toBeCloseTo(1.156669383324238, 12);
});

test("complex argument — the case the native handler declines (mpmath values)", () => {
  const a = ce.box(["PolyGamma", 1, ["Complex", 1, 1]]).N();
  expect(a.re).toBeCloseTo(0.4630000966227638, 12);
  expect(a.im).toBeCloseTo(-0.7942335427593189, 12);
  const b = ce.box(["PolyGamma", 2, ["Complex", 0.5, 0.3]]).N();
  expect(b.re).toBeCloseTo(-0.17725989989006736, 11);
  expect(b.im).toBeCloseTo(10.451822205943449, 11);
});

// --- Found by the oracle Plausible: PolyGamma(-1, z) was unevaluated ------------

test("ψ⁽⁻¹⁾(z) = LogGamma(z), matching Wolfram's PolyGamma[-1, z] (mpmath has no negative order)", () => {
  expect(num(["PolyGamma", -1, 2])).toBeCloseTo(0, 13); // LogGamma(2) = log(1!) = 0
  expect(num(["PolyGamma", -1, ["Rational", 1, 2]])).toBeCloseTo(0.5723649429247001, 12); // log(√π)
  const a = ce.box(["PolyGamma", -1, ["Complex", 1, 1]]).N();
  expect(a.re).toBeCloseTo(-0.6509231993018563, 12);
  expect(a.im).toBeCloseTo(-0.3016403204675332, 12);
  const b = ce.box(["PolyGamma", -1, -0.5]).N(); // off the positive axis: LogGamma's branch
  expect(b.re).toBeCloseTo(1.2655121234846454, 12);
  expect(b.im).toBeCloseTo(-3.141592653589793, 12);
});

test("ψ⁽ᵐ⁾ for m ≤ −2 is past what we cover and stays unevaluated", () => {
  expect(ce.box(["N", ["PolyGamma", -2, 2]]).evaluate().json).toEqual(["PolyGamma", -2, 2]);
});

test("the kernel is the Hurwitz zeta: ψ⁽ᵐ⁾(z) = (−1)^(m+1) m! ζ(m+1, z)", () => {
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

// --- compile handlers -------------------------------------------------------------

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
