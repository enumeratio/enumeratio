import { readFileSync } from "node:fs";
import { ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { barnesG, logBarnesG } from "../src/barnes-g.ts";
import { mul as mulCx } from "../src/complex.ts";
import { character, eulerPhi } from "../src/dirichlet-l.ts";
import { clausen } from "../src/clausen.ts";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { logGamma } from "../src/loggamma.ts";
import { stieltjesGamma } from "../src/stieltjes.ts";

// BarnesG, LogBarnesG, LogGamma, ClausenCl, DirichletEta, DirichletBeta, StieltjesGamma,
// DirichletCharacter, DirichletL, and the third argument added to Gamma / GammaRegularized.
// Exact closed forms are pinned symbolically; numeric evaluation is held to the oracle
// values in special-functions.golden.json, which scripts/collect-special-goldens.ts
// gathers from mpmath and a Wolfram kernel (neither is needed to run this file).

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const sameExact = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const exactJson = (input: Expr, expected: unknown) => expect(ce.box(input).evaluate().json).toEqual(expected);
const num = (input: Expr): number => ce.box(input).N().re;

// --- Oracle goldens ------------------------------------------------------------------

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./special-functions.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

// One test per head rather than per case: the character tables alone are ~1800 rows, and a
// test each would swamp the suite's output for no extra signal.
const byHead = new Map<string, GoldenCase[]>();
for (const g of goldens) byHead.set(g.head, [...(byHead.get(g.head) ?? []), g]);

for (const [head, cases] of byHead) {
  test(`${head}: ${cases.length} cases match the oracles`, () => {
    const off: string[] = [];
    for (const g of cases) {
      const r = ce.box([g.head, ...g.args] as never).N();
      const ours: [number, number] = [r.re, r.im];
      expect(g.mpmath ?? g.wolfram, g.label).toBeDefined(); // every row has an oracle
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
      "BarnesG",
      "ClausenCl",
      "DirichletBeta",
      "DirichletCharacter",
      "DirichletEta",
      "DirichletL",
      "Gamma",
      "GammaRegularized",
      "HarmonicNumber",
      "LogBarnesG",
      "LogGamma",
      "StieltjesGamma",
    ].sort(),
  );
});

// --- BarnesG / LogBarnesG ------------------------------------------------------------

test("G(n) is the superfactorial at positive integers, exactly", () => {
  exactJson(["BarnesG", 1], 1);
  exactJson(["BarnesG", 2], 1);
  exactJson(["BarnesG", 3], 1);
  exactJson(["BarnesG", 4], 2);
  exactJson(["BarnesG", 5], 12);
  exactJson(["BarnesG", 6], 288);
  exactJson(["BarnesG", 7], 34560);
  // G(30) = Π_{k≤28} k! — far past double; an exact big integer.
  const g30 = ce.box(["BarnesG", 30]).evaluate();
  expect(isNumber(g30)).toBe(true);
  expect(g30.re).toBeGreaterThan(1e300);
});

test("G vanishes at the nonpositive integers; ln G is −∞ there", () => {
  exactJson(["BarnesG", 0], 0);
  exactJson(["BarnesG", -3], 0);
  expect(barnesG({ re: -2, im: 0 })).toEqual({ re: 0, im: 0 });
});

test("G(z+1) = Γ(z) G(z), numerically, off the real axis", () => {
  const z = { re: 1.7, im: -0.6 };
  const lhs = barnesG({ re: z.re + 1, im: z.im });
  // Γ(z) G(z) = exp(lnΓ(z) + ln G(z))
  const s = logGamma(z);
  const t = logBarnesG(z);
  const rhs = {
    re: Math.exp(s.re + t.re) * Math.cos(s.im + t.im),
    im: Math.exp(s.re + t.re) * Math.sin(s.im + t.im),
  };
  expect(lhs.re).toBeCloseTo(rhs.re, 12);
  expect(lhs.im).toBeCloseTo(rhs.im, 12);
});

test("BarnesG stays symbolic for an exact non-integer and for a symbol", () => {
  exactJson(["BarnesG", ["Rational", 5, 2]], ["BarnesG", ["Rational", 5, 2]]);
  exactJson(["BarnesG", "z"], ["BarnesG", "z"]);
  expect(num(["BarnesG", ["Rational", 5, 2]])).toBeCloseTo(0.9475739010840627, 12);
});

// --- LogGamma ------------------------------------------------------------------------

test("LogGamma closed forms: lnΓ(n) = ln (n−1)!, lnΓ(½) = ½ ln π, poles → ∞", () => {
  sameExact(["LogGamma", 3], ["Ln", 2]);
  exactJson(["LogGamma", 1], 0);
  sameExact(["LogGamma", ["Rational", 1, 2]], ["Divide", ["Ln", "Pi"], 2]);
  exactJson(["LogGamma", 0], "PositiveInfinity");
  exactJson(["LogGamma", -2], "PositiveInfinity");
});

test("LogGamma is the continuation, not the principal log of Γ (Wolfram convention)", () => {
  // LogGamma[-2.5 + 1.5 I] = -3.7175… - 7.7131 I, where Log[Gamma[…]] has imaginary part -1.43.
  const v = logGamma({ re: -2.5, im: 1.5 });
  expect(v.re).toBeCloseTo(-3.7175134511917927, 12);
  expect(v.im).toBeCloseTo(-7.7130655258341925, 12);
});

// --- ClausenCl -----------------------------------------------------------------------

test("the kernel's 2π periodicity / oddness", () => {
  expect(clausen(2, 1 + 2 * Math.PI)).toBeCloseTo(clausen(2, 1), 14);
  expect(clausen(2, -1)).toBeCloseTo(-clausen(2, 1), 14);
  expect(clausen(3, -1)).toBeCloseTo(clausen(3, 1), 14);
  expect(clausen(1, 1)).toBeCloseTo(-Math.log(Math.abs(2 * Math.sin(0.5))), 14);
});

test("Cl₂(π/3) = 1.0149416064096536…, the maximum of Cl₂", () => {
  expect(clausen(2, Math.PI / 3)).toBeCloseTo(1.0149416064096535, 13);
});

// --- DirichletEta / DirichletBeta ----------------------------------------------------

// --- StieltjesGamma ------------------------------------------------------------------

test("the shift identity γ_n(a+1) = γ_n(a) − lnⁿ(a)/a", () => {
  // ζ(s, a+1) = ζ(s, a) − a^{−s} ⇒ γ_n(a+1) = γ_n(a) − lnⁿ(a)/a; at a = 1 the correction is 0 for n ≥ 1.
  expect(stieltjesGamma(3, { re: 2, im: 0 }).re).toBeCloseTo(stieltjesGamma(3, { re: 1, im: 0 }).re, 14);
  const a = { re: 0.5, im: 0 };
  expect(stieltjesGamma(2, { re: 1.5, im: 0 }).re).toBeCloseTo(stieltjesGamma(2, a).re - Math.log(0.5) ** 2 / 0.5, 13);
});

// --- HarmonicNumber --------------------------------------------------------------------

// --- Catalan -------------------------------------------------------------------------

test("Catalan is a held numeric constant, like EulerGamma", () => {
  exactJson("Catalan", "Catalan");
  expect(num("Catalan")).toBeCloseTo(0.915965594177219, 15);
});

// --- DirichletCharacter / DirichletL ------------------------------------------------

test("the table is orthogonal: Σ_n χ_j(n) = 0 for a non-principal χ, φ(k) for the principal one", () => {
  // Σ_n χ_j(n) = 0 for a non-principal χ, and φ(k) for the principal one.
  for (const k of [5, 8, 12, 15]) {
    for (let j = 1; j <= eulerPhi(k); j++) {
      let re = 0;
      let im = 0;
      for (let n = 1; n <= k; n++) {
        const c = character(k, j, n);
        re += c.re;
        im += c.im;
      }
      expect(Math.hypot(re - (j === 1 ? eulerPhi(k) : 0), im)).toBeLessThan(1e-12);
    }
  }
});

test("χ is completely multiplicative", () => {
  for (const k of [7, 9, 16, 40]) {
    for (let j = 1; j <= eulerPhi(k); j++) {
      for (let m = 1; m <= k; m++) {
        for (let n = 1; n <= k; n++) {
          const lhs = character(k, j, m * n);
          const rhs = mulCx(character(k, j, m), character(k, j, n));
          expect(Math.hypot(lhs.re - rhs.re, lhs.im - rhs.im)).toBeLessThan(1e-12);
        }
      }
    }
  }
});

// --- The third argument on Gamma / GammaRegularized ---------------------------------

test("Gamma keeps its native one- and two-argument behaviour", () => {
  // Exact integers and half-integers reduce (widened.ts's gammaExact), unlike vanilla CE.
  exactJson(["Gamma", 5], 24);
  expect(num(["Gamma", 5])).toBe(24);
  expect(num(["Gamma", 2.5, 1.5])).toBeCloseTo(0.9305194427867924, 13);
  const c = ce.box(["Gamma", 2.5, ["Complex", 1.5, 1]]).N();
  expect(c.re).toBeCloseTo(0.9148161703240987, 13);
  expect(c.im).toBeCloseTo(-0.4535560131834822, 13);
});

test("Γ(s, z₀, z₁) = Γ(s, z₀) − Γ(s, z₁); z₀ = 0 is the LOWER incomplete gamma", () => {
  // γ(5/2, 3/2) = Γ(5/2) − Γ(5/2, 3/2) = 0.3988209453923446…
  expect(num(["Gamma", 2.5, 0, 1.5])).toBeCloseTo(0.3988209453923446, 13);
  expect(num(["Gamma", 2.5, 1.5, 3.0])).toBeCloseTo(0.5234502669154886, 13);
});

test("Γ(1, z) = e^{−z}, so Γ(1, 0, z) collapses to 1 − e^{−z} (Wolfram's reduction)", () => {
  sameExact(["Gamma", 1, "z"], ["Exp", ["Negate", "z"]]);
  sameExact(["Gamma", 1, 0, "z"], ["Subtract", 1, ["Exp", ["Negate", "z"]]]);
  expect(num(["Gamma", 1, 0, 2.0])).toBeCloseTo(1 - Math.exp(-2), 14);
});

test("a three-argument call that cannot reduce keeps its own form", () => {
  // Γ(s, 0, z) with a fully symbolic order still can't reduce either half.
  exactJson(["Gamma", "s", 0, "z"], ["Gamma", "s", 0, "z"]);
});

test("Γ(2, 0, z) now reduces through Γ(2, z) = (1+z)e^{-z} (see generalized-special.ts)", () => {
  sameExact(["Gamma", 2, 0, "z"], ["Subtract", 1, ["Multiply", ["Add", "z", 1], ["Exp", ["Negate", "z"]]]]);
});
