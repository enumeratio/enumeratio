import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The twelve Jacobi `pq` functions (sn, cn, dn and their nine quotients/reciprocals),
// JacobiAmplitude and JacobiZN — Wolfram/mpmath's m = k² parameter convention throughout.
// Numeric evaluation (descending Landen/AGM, Abramowitz & Stegun 16.4) is held to the
// oracle values in jacobi-elliptic.golden.json, gathered from mpmath (ellipfun) and a
// Wolfram kernel by scripts/collect-jacobi-elliptic-goldens.ts (neither oracle is needed
// to run this file).

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./jacobi-elliptic.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

const byHead = new Map<string, GoldenCase[]>();
for (const g of goldens) byHead.set(g.head, [...(byHead.get(g.head) ?? []), g]);

for (const [head, cases] of byHead) {
  test(`${head}: ${cases.length} cases match the oracles`, () => {
    const off: string[] = [];
    for (const g of cases) {
      const r = ce.box([g.head, ...g.args] as never).N();
      const ours: [number, number] = [r.re, r.im];
      expect(g.mpmath ?? g.wolfram, g.label).toBeDefined();
      for (const [name, ref] of [
        ["mpmath", g.mpmath],
        ["wolfram", g.wolfram],
      ] as const) {
        if (!ref) continue;
        const err = relErr(ours, ref);
        if (!(err <= g.tol)) off.push(`${g.label} vs ${name}: relerr ${err.toExponential(2)}`);
      }
    }
    expect(off).toEqual([]);
  });
}

test("the golden file covers every head", () => {
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].sort()).toEqual(
    [
      "JacobiSN",
      "JacobiCN",
      "JacobiDN",
      "JacobiCD",
      "JacobiCS",
      "JacobiDC",
      "JacobiDS",
      "JacobiNC",
      "JacobiND",
      "JacobiNS",
      "JacobiSC",
      "JacobiSD",
      "JacobiAmplitude",
      "JacobiZN",
    ].sort(),
  );
});

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
  expect(ce.box(["JacobiSN", "u", 1]).evaluate().json).toEqual(["Tanh", "u"]);
  expect(ce.box(["JacobiCN", "u", 1]).evaluate().json).toEqual(["Divide", 1, ["Cosh", "u"]]);
  expect(ce.box(["JacobiCN", "u", 1]).evaluate().json).toEqual(ce.box(["JacobiDN", "u", 1]).evaluate().json);
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
  expect(lhs.re).toBeCloseTo(1, 8);
  expect(lhs.im).toBeCloseTo(0, 8);
});

test("dn^2 + m*sn^2 = 1 at a complex point", () => {
  const u = ["Complex", 0.4, 0.3] as const;
  const m = 0.6;
  const sn = ce.box(["JacobiSN", u, m]).N();
  const dn = ce.box(["JacobiDN", u, m]).N();
  const sn2 = { re: sn.re * sn.re - sn.im * sn.im, im: 2 * sn.re * sn.im };
  const dn2 = { re: dn.re * dn.re - dn.im * dn.im, im: 2 * dn.re * dn.im };
  const lhs = { re: dn2.re + m * sn2.re, im: dn2.im + m * sn2.im };
  expect(lhs.re).toBeCloseTo(1, 8);
  expect(lhs.im).toBeCloseTo(0, 8);
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

test("JacobiAmplitude and JacobiZN decline outside m in [0,1]", () => {
  expect(ce.box(["JacobiAmplitude", 0.3, 1.5]).N().operator).toBe("JacobiAmplitude");
  expect(ce.box(["JacobiZN", 0.3, -0.5]).N().operator).toBe("JacobiZN");
});
