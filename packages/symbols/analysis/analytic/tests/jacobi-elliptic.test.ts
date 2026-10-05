import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// The twelve Jacobi `pq` functions (sn, cn, dn and their nine quotients/reciprocals),
// JacobiAmplitude and JacobiZN — Wolfram/mpmath's m = k² parameter convention throughout.
// Numeric evaluation (descending Landen/AGM, Abramowitz & Stegun 16.4). Oracle coverage
// (mpmath and a Wolfram kernel, across real/complex u and m) now lives as `known` values
// on the reference examples (packages/reference/tests/known.test.ts), not here.

const ce = new ComputeEngine();
declareAnalytic(ce);

// --- Exact special values ------------------------------------------------------------

test("u = 0: sn = 0, cn = dn = 1, for any (symbolic) m", () => {
  expect(ce.box(["JacobiSN", 0, "m"]).evaluate().json).toEqual(0);
  expect(ce.box(["JacobiCN", 0, "m"]).evaluate().json).toEqual(1);
  expect(ce.box(["JacobiDN", 0, "m"]).evaluate().json).toEqual(1);
  expect(ce.box(["JacobiNS", 0, "m"]).evaluate().json).toEqual("ComplexInfinity"); // pole
});

test("m = 0: sn = Sin(u), cn = Cos(u), dn = 1, for symbolic u", () => {
  expect(ce.box(["JacobiSN", "u", 0]).evaluate().json).toEqual(["Sin", "u"]);
  expect(ce.box(["JacobiCN", "u", 0]).evaluate().json).toEqual(["Cos", "u"]);
  expect(ce.box(["JacobiDN", "u", 0]).evaluate().json).toEqual(1);
});

test("m = 1: sn = Tanh(u), cn = dn = Sech(u), for symbolic u", () => {
  // sn is Tanh(u) in its own name; cn is built on Cosh(u) rather than Sech(u) directly (see
  // jacobi-elliptic.ts's exactSCDN) so sc/sd/cs/ds don't divide two things that both blow up
  // at u = iπ/2 + ikπ.
  expect(ce.box(["JacobiSN", "u", 1]).evaluate().json).toEqual(["Tanh", "u"]);
  expect(ce.box(["JacobiCN", "u", 1]).evaluate().json).toEqual(["Divide", 1, ["Cosh", "u"]]);
  expect(ce.box(["JacobiCN", "u", 1]).evaluate().json).toEqual(ce.box(["JacobiDN", "u", 1]).evaluate().json);
});

test("m = 1, complex u at a pole of sn/cn individually: sc/sd/cs/ds stay finite", () => {
  // u = iπ/2: sn(u,1) = tanh(u) and cn(u,1) = dn(u,1) = sech(u) are each ComplexInfinity
  // (cosh(u) = 0 there), but sc = sn/cn = sinh(u) and cs = 1/sinh(u) are finite — the whole
  // point of exactSCDN sharing Cosh(u) as the pq family's one denominator.
  const u = ["Multiply", ["Rational", 1, 2], "ImaginaryUnit", "Pi"];
  for (const head of ["JacobiSC", "JacobiSD"]) {
    const r = ce.box([head, u, 1] as never).N();
    expect(r.re).toBeCloseTo(0, 12);
    expect(r.im).toBeCloseTo(1, 12);
  }
  for (const head of ["JacobiCS", "JacobiDS"]) {
    const r = ce.box([head, u, 1] as never).N();
    expect(r.re).toBeCloseTo(0, 12);
    expect(r.im).toBeCloseTo(-1, 12);
  }
});

test("m = 1, concrete u: sn/cn/dn reduce to a decimal matching tanh/sech directly", () => {
  const u = 0.7;
  expect(ce.box(["JacobiSN", u, 1]).N().re).toBeCloseTo(Math.tanh(u), 12);
  expect(ce.box(["JacobiCN", u, 1]).N().re).toBeCloseTo(1 / Math.cosh(u), 12);
  expect(ce.box(["JacobiDN", u, 1]).N().re).toBeCloseTo(1 / Math.cosh(u), 12);
});

test("quarter period: sn(K(m),m) = 1, cn(K(m),m) = 0, dn(K(m),m) = sqrt(1-m)", () => {
  // Symbolic m: EllipticK(m) stays symbolic, so this exercises the exact structural
  // match (see jacobi-elliptic.ts's exactSCDN) rather than the numeric AGM kernel.
  expect(ce.box(["JacobiSN", ["EllipticK", "m"], "m"]).evaluate().json).toEqual(1);
  expect(ce.box(["JacobiCN", ["EllipticK", "m"], "m"]).evaluate().json).toEqual(0);
  const dnExact = ce.box(["JacobiDN", ["EllipticK", "m"], "m"]).evaluate();
  expect(dnExact.operator).toBe("Sqrt"); // Sqrt(1 - m), symbolic
  // Concrete m: EllipticK(m) evaluates eagerly to a float, so this instead checks the
  // numeric AGM kernel agrees with the same identity to floating-point precision.
  const m = 0.3;
  const dn = ce.box(["JacobiDN", ["EllipticK", m], m]).N().re;
  expect(dn).toBeCloseTo(Math.sqrt(1 - m), 9);
});

test("stays symbolic under plain evaluate at generic symbolic operands; a float argument evaluates numerically", () => {
  expect(ce.box(["JacobiSN", "u", "m"]).evaluate().json).toEqual(["JacobiSN", "u", "m"]);
  expect(ce.box(["JacobiSN", 0.3, 0.5]).evaluate().re).toBeCloseTo(0.2934127331684554, 12);
});

test("a genuinely complex m is declined (stays symbolic even under N())", () => {
  const r = ce.box(["JacobiSN", 0.3, ["Complex", 0.5, 0.2]]).N();
  expect(r.operator).toBe("JacobiSN");
});

// --- Identities ------------------------------------------------------------------

test("sn^2 + cn^2 = 1 at a complex point", () => {
  const u = ["Complex", 0.4, 0.3] as const;
  const m = 0.6;
  const sn = ce.box(["JacobiSN", u, m]).N();
  const cn = ce.box(["JacobiCN", u, m]).N();
  const lhs = {
    re: sn.re * sn.re - sn.im * sn.im + cn.re * cn.re - cn.im * cn.im,
    im: 2 * sn.re * sn.im + 2 * cn.re * cn.im,
  };
  expect(lhs.re).toBeCloseTo(1, 12);
  expect(lhs.im).toBeCloseTo(0, 12);
});

test("dn^2 + m*sn^2 = 1 at a complex point", () => {
  const u = ["Complex", 0.4, 0.3] as const;
  const m = 0.6;
  const sn = ce.box(["JacobiSN", u, m]).N();
  const dn = ce.box(["JacobiDN", u, m]).N();
  const sn2 = { re: sn.re * sn.re - sn.im * sn.im, im: 2 * sn.re * sn.im };
  const dn2 = { re: dn.re * dn.re - dn.im * dn.im, im: 2 * dn.re * dn.im };
  const lhs = { re: dn2.re + m * sn2.re, im: dn2.im + m * sn2.im };
  expect(lhs.re).toBeCloseTo(1, 12);
  expect(lhs.im).toBeCloseTo(0, 12);
});

// Regression: coordinator review of B-55 caught JacobiCN(1+i, 0.3) off by ~1.3e-12
// relative under the earlier complex-u kernel (the AGM/amplitude recursion carried
// directly in complex arithmetic). Pinned against mpmath/Wolfram (agreeing to 18
// digits) now that jacobi-elliptic.ts uses DLMF 22.8's real addition formulas instead.
test("JacobiCN(1+i, 0.3) matches mpmath/Wolfram to double precision (regression)", () => {
  const r = ce.box(["JacobiCN", ["Complex", 1, 1], 0.3]).N();
  expect(r.re).toBeCloseTo(0.7010548521777622, 13);
  expect(r.im).toBeCloseTo(-0.8574509113879215, 13);
});

test("sn/cn/dn stay accurate very close to sn's pole at u = i*K'(m)", () => {
  const m = 0.3;
  const kPrime = ce.box(["EllipticK", 1 - m]).N().re;
  // 1e-3 short of the pole — reference values from mpmath's ellipfun (30 digits).
  const u = ["Complex", 0.05, kPrime - 0.001] as const;
  const sn = ce.box(["JacobiSN", u, m]).N();
  const cn = ce.box(["JacobiCN", u, m]).N();
  const dn = ce.box(["JacobiDN", u, m]).N();
  expect(sn.re).toBeCloseTo(36.52001659546388, 8);
  expect(sn.im).toBeCloseTo(0.7296091247708486, 8);
  expect(cn.re).toBeCloseTo(0.7298826951670783, 8);
  expect(cn.im).toBeCloseTo(-36.5063283747724, 8);
  expect(dn.re).toBeCloseTo(0.40012350088472864, 8);
  expect(dn.im).toBeCloseTo(-19.977834807940592, 8);
});

test("quasi-periodicity holds at a complex point too: sn(u+2K,m) = -sn(u,m)", () => {
  const m = 0.4;
  const twoK = ce.box(["Multiply", 2, ["EllipticK", m]]).N().re;
  const sn0 = ce.box(["JacobiSN", ["Complex", 0.35, 0.6], m]).N();
  const snShifted = ce.box(["JacobiSN", ["Complex", 0.35 + twoK, 0.6], m]).N();
  expect(snShifted.re).toBeCloseTo(-sn0.re, 10);
  expect(snShifted.im).toBeCloseTo(-sn0.im, 10);
});

test("quasi-periodicity: sn(u+2K,m) = -sn(u,m), cn(u+2K,m) = -cn(u,m), dn(u+2K,m) = dn(u,m)", () => {
  const m = 0.4;
  const u = 0.35;
  const twoK = ce.box(["Multiply", 2, ["EllipticK", m]]).N().re;
  const sn0 = ce.box(["JacobiSN", u, m]).N().re;
  const cn0 = ce.box(["JacobiCN", u, m]).N().re;
  const dn0 = ce.box(["JacobiDN", u, m]).N().re;
  const snShifted = ce.box(["JacobiSN", u + twoK, m]).N().re;
  const cnShifted = ce.box(["JacobiCN", u + twoK, m]).N().re;
  const dnShifted = ce.box(["JacobiDN", u + twoK, m]).N().re;
  expect(snShifted).toBeCloseTo(-sn0, 8);
  expect(cnShifted).toBeCloseTo(-cn0, 8);
  expect(dnShifted).toBeCloseTo(dn0, 8);
});

test("JacobiAmplitude(0,m) = 0, JacobiAmplitude(u,0) = u", () => {
  expect(ce.box(["JacobiAmplitude", 0, 0.4]).evaluate().json).toEqual(0);
  expect(ce.box(["JacobiAmplitude", "u", 0]).evaluate().json).toEqual("u");
});

test("JacobiZN(0,m) = 0, JacobiZN(u,0) = 0", () => {
  expect(ce.box(["JacobiZN", 0, 0.4]).evaluate().json).toEqual(0);
  expect(ce.box(["JacobiZN", 0.7, 0]).evaluate().json).toEqual(0);
});

// Wolfram farm sweep (A-130): JacobiZN(u,1) = Tanh(u) held symbolically unevaluated —
// only the numeric AGM path answered, and only for a concrete float u. Z(u,1) = sin(am(u,1))
// = sin(gd(u)) = tanh(u) (the E(1)/K(1)·u term vanishes), so this holds for any u.
test("JacobiZN(u,1) = Tanh(u), symbolic or concrete", () => {
  expect(ce.box(["JacobiZN", "u", 1]).evaluate().json).toEqual(["Tanh", "u"]);
  const u = ce.box(["Multiply", ["Complex", 0, ["Rational", -1, 3]], "Pi"]);
  const z = ce.box(["JacobiZN", u, 1]).N();
  expect(z.re).toBeCloseTo(0, 10);
  expect(z.im).toBeCloseTo(-Math.sqrt(3), 10);
});

test("JacobiAmplitude and JacobiZN decline outside m in [0,1]", () => {
  expect(ce.box(["JacobiAmplitude", 0.3, 1.5]).N().operator).toBe("JacobiAmplitude");
  expect(ce.box(["JacobiZN", 0.3, -0.5]).N().operator).toBe("JacobiZN");
});
