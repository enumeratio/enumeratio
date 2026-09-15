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
const exactJson = (input: Expr, expected: unknown) =>
  expect(ce.box(input).evaluate().json).toEqual(expected);
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
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

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
  exactJson(["LogBarnesG", 0], "NegativeInfinity");
  expect(barnesG({ re: -2, im: 0 })).toEqual({ re: 0, im: 0 });
});

test("ln G(n) reduces through the integer value: ln G(4) = ln 2, ln G(3) = 0", () => {
  sameExact(["LogBarnesG", 4], ["Ln", 2]);
  exactJson(["LogBarnesG", 3], 0);
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

test("Cl₂(π/2) = Catalan, Cl₂(π) = 0, Cl₂(0) = 0", () => {
  exactJson(["ClausenCl", 2, ["Divide", "Pi", 2]], "Catalan");
  exactJson(["ClausenCl", 2, "Pi"], 0);
  exactJson(["ClausenCl", 2, 0], 0);
  expect(num(["ClausenCl", 2, ["Divide", "Pi", 2]])).toBeCloseTo(0.915965594177219, 14);
});

test("odd orders are the cosine series: Cl₃(0) = ζ(3), Cl₃(π) = −η(3), Cl₃(π/2) = −η(3)/8", () => {
  sameExact(["ClausenCl", 3, 0], ["Zeta", 3]);
  sameExact(["ClausenCl", 3, "Pi"], ["Multiply", ["Rational", -3, 4], ["Zeta", 3]]);
  sameExact(["ClausenCl", 3, ["Divide", "Pi", 2]], ["Multiply", ["Rational", -3, 32], ["Zeta", 3]]);
  exactJson(["ClausenCl", 1, 0], "PositiveInfinity");
});

test("Cl₄(π/2) = β(4) and the kernel's 2π periodicity / oddness", () => {
  exactJson(["ClausenCl", 4, ["Divide", "Pi", 2]], ["DirichletBeta", 4]);
  expect(clausen(2, 1 + 2 * Math.PI)).toBeCloseTo(clausen(2, 1), 14);
  expect(clausen(2, -1)).toBeCloseTo(-clausen(2, 1), 14);
  expect(clausen(3, -1)).toBeCloseTo(clausen(3, 1), 14);
  expect(clausen(1, 1)).toBeCloseTo(-Math.log(Math.abs(2 * Math.sin(0.5))), 14);
});

test("Cl₂(π/3) = 1.0149416064096536…, the maximum of Cl₂", () => {
  expect(clausen(2, Math.PI / 3)).toBeCloseTo(1.0149416064096535, 13);
});

// --- DirichletEta / DirichletBeta ----------------------------------------------------

test("η at the integers: η(1) = ln 2, η(2) = π²/12, η(0) = ½, η(−1) = ¼, η(3) = ¾ ζ(3)", () => {
  sameExact(["DirichletEta", 1], ["Ln", 2]);
  sameExact(["DirichletEta", 2], ["Divide", ["Power", "Pi", 2], 12]);
  exactJson(["DirichletEta", 0], ["Rational", 1, 2]);
  exactJson(["DirichletEta", -1], ["Rational", 1, 4]);
  sameExact(["DirichletEta", 3], ["Multiply", ["Rational", 3, 4], ["Zeta", 3]]);
  exactJson(["DirichletEta", ["Rational", 1, 2]], ["DirichletEta", ["Rational", 1, 2]]);
});

test("β at the integers: β(1) = π/4, β(2) = Catalan, β(3) = π³/32, β(5) = 5π⁵/1536, β(7) = 61π⁷/184320", () => {
  sameExact(["DirichletBeta", 1], ["Divide", "Pi", 4]);
  exactJson(["DirichletBeta", 2], "Catalan");
  sameExact(["DirichletBeta", 3], ["Divide", ["Power", "Pi", 3], 32]);
  sameExact(["DirichletBeta", 5], ["Multiply", ["Rational", 5, 1536], ["Power", "Pi", 5]]);
  sameExact(["DirichletBeta", 7], ["Multiply", ["Rational", 61, 184320], ["Power", "Pi", 7]]);
});

test("β at nonpositive integers are Euler numbers: β(0) = ½, β(−2) = −½, β(−4) = 5/2, β(−3) = 0", () => {
  exactJson(["DirichletBeta", 0], ["Rational", 1, 2]);
  exactJson(["DirichletBeta", -2], ["Rational", -1, 2]);
  exactJson(["DirichletBeta", -4], ["Rational", 5, 2]);
  exactJson(["DirichletBeta", -6], ["Rational", -61, 2]);
  exactJson(["DirichletBeta", -3], 0);
  exactJson(["DirichletBeta", 4], ["DirichletBeta", 4]); // no closed form at even s ≥ 4
});

test("η(s) = (1 − 2^{1−s}) ζ(s) numerically; β(s) = 4^{−s}(ζ(s,¼) − ζ(s,¾))", () => {
  expect(num(["DirichletEta", 0.5])).toBeCloseTo((1 - Math.SQRT2) * -1.4603545088095868, 13);
  expect(num(["DirichletBeta", 2])).toBeCloseTo(0.915965594177219, 14);
  expect(num(["DirichletBeta", 4])).toBeCloseTo(0.9889445517411053, 13);
});

// --- StieltjesGamma ------------------------------------------------------------------

test("γ₀ = EulerGamma, γ₀(a) = −ψ(a), poles at a ∈ {0, −1, …}", () => {
  exactJson(["StieltjesGamma", 0], "EulerGamma");
  sameExact(["StieltjesGamma", 0, "x"], ["Negate", ["PolyGamma", 0, "x"]]);
  exactJson(["StieltjesGamma", 2, -1], "ComplexInfinity");
  exactJson(["StieltjesGamma", 1], ["StieltjesGamma", 1]); // no closed form
});

test("γ₁, γ₂ values and the shift identity γ_n(a+1) = γ_n(a) − lnⁿ(a)/a", () => {
  expect(num(["StieltjesGamma", 1])).toBeCloseTo(-0.0728158454836767, 14);
  expect(num(["StieltjesGamma", 2])).toBeCloseTo(-0.0096903631928723, 14);
  // ζ(s, a+1) = ζ(s, a) − a^{−s} ⇒ γ_n(a+1) = γ_n(a) − lnⁿ(a)/a; at a = 1 the correction is 0 for n ≥ 1.
  expect(stieltjesGamma(3, { re: 2, im: 0 }).re).toBeCloseTo(
    stieltjesGamma(3, { re: 1, im: 0 }).re,
    14,
  );
  const a = { re: 0.5, im: 0 };
  expect(stieltjesGamma(2, { re: 1.5, im: 0 }).re).toBeCloseTo(
    stieltjesGamma(2, a).re - Math.log(0.5) ** 2 / 0.5,
    13,
  );
});

test("orders past 30 stay symbolic — the double-precision kernel is not trusted there", () => {
  exactJson(["StieltjesGamma", 40], ["StieltjesGamma", 40]);
  expect(ce.box(["StieltjesGamma", 40]).N().json).toEqual(["StieltjesGamma", 40]);
});

// --- HarmonicNumber --------------------------------------------------------------------

test("H_n is the exact rational sum Σ 1/k, and H_0 = 0", () => {
  exactJson(["HarmonicNumber", 0], 0);
  exactJson(["HarmonicNumber", 1], 1);
  exactJson(["HarmonicNumber", 2], ["Rational", 3, 2]);
  exactJson(["HarmonicNumber", 10], ["Rational", 7381, 2520]);
});

test("HarmonicNumber(n, r) is the exact generalized sum Σ k^{-r}, r of either sign", () => {
  exactJson(["HarmonicNumber", 10, 3], ["Rational", 19164113947, 16003008000]);
  exactJson(["HarmonicNumber", 5, -1], 15); // Σ k = 15
  exactJson(["HarmonicNumber", 5, 0], 5); // Σ 1 = 5
  exactJson(["HarmonicNumber", 0, 3], 0);
});

test("negative integer n has no sum: ComplexInfinity, one or two arguments", () => {
  exactJson(["HarmonicNumber", -1], "ComplexInfinity");
  exactJson(["HarmonicNumber", -3], "ComplexInfinity");
  exactJson(["HarmonicNumber", -2, 3], "ComplexInfinity");
});

test("stays symbolic for a symbol or a non-integer order under plain evaluate", () => {
  exactJson(["HarmonicNumber", "n"], ["HarmonicNumber", "n"]);
  exactJson(["HarmonicNumber", 5, ["Rational", 1, 2]], ["HarmonicNumber", 5, ["Rational", 1, 2]]);
});

test("H_z = ψ(z+1) + γ off the integers (Wolfram values)", () => {
  expect(num(["HarmonicNumber", 2.5])).toBeCloseTo(1.680372305546776, 13);
  expect(num(["HarmonicNumber", 0.5])).toBeCloseTo(0.6137056388801094, 13);
});

test("HarmonicNumber(z, r) = ζ(r) − ζ(r, z+1) off the integers (Wolfram values)", () => {
  expect(num(["HarmonicNumber", ["Rational", 1, 2], 2])).toBeCloseTo(0.7101318663035469, 13);
  expect(num(["HarmonicNumber", 5, ["Rational", 1, 2]])).toBeCloseTo(3.2316706458761312, 12);
});

test("complex z (mpmath/Wolfram agree via golden), and a float argument evaluates under plain evaluate()", () => {
  const c = ce.box(["HarmonicNumber", ["Complex", 3, 2]]).N();
  expect(c.re).toBeCloseTo(1.9725764110447412, 12);
  expect(c.im).toBeCloseTo(0.5169611287960764, 12);
  expect(num(["HarmonicNumber", 5.0])).toBeCloseTo(2.283333333333333, 13);
});

// --- Catalan -------------------------------------------------------------------------

test("Catalan is a held numeric constant, like EulerGamma", () => {
  exactJson("Catalan", "Catalan");
  expect(num("Catalan")).toBeCloseTo(0.915965594177219, 15);
});

// --- DirichletCharacter / DirichletL ------------------------------------------------

test("χ_1 is principal; χ_j vanishes off the units; the table is orthogonal", () => {
  exactJson(["DirichletCharacter", 5, 1, 2], 1);
  exactJson(["DirichletCharacter", 5, 2, 2], ["Complex", 0, 1]);
  exactJson(["DirichletCharacter", 5, 2, 5], 0);
  exactJson(["DirichletCharacter", 4, 2, 3], -1);
  exactJson(["DirichletCharacter", 1, 1, 7], 1); // the trivial character mod 1 is 1 everywhere
  // Out of range stays symbolic: j must be at most φ(k).
  exactJson(["DirichletCharacter", 5, 9, 2], ["DirichletCharacter", 5, 9, 2]);
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

test("L(s, χ) reductions: ζ for k = 1, the beta function mod 4, the ζ-product for principal χ", () => {
  sameExact(["DirichletL", 1, 1, "s"], ["Zeta", "s"]);
  sameExact(["DirichletL", 1, 1, 2], ["Zeta", 2]);
  sameExact(["DirichletL", 4, 2, 1], ["Divide", "Pi", 4]); // = β(1)
  sameExact(["DirichletL", 4, 2, 3], ["DirichletBeta", 3]);
  // Principal χ mod k drops the Euler factors at the primes dividing k.
  sameExact(
    ["DirichletL", 12, 1, "s"],
    [
      "Multiply",
      ["Zeta", "s"],
      ["Subtract", 1, ["Power", 2, ["Negate", "s"]]],
      ["Subtract", 1, ["Power", 3, ["Negate", "s"]]],
    ],
  );
  exactJson(["DirichletL", 12, 1, 1], "ComplexInfinity"); // ζ's pole survives
});

test("L(−n, χ) is exact: a rational combination of roots of unity", () => {
  exactJson(["DirichletL", 5, 2, 0], ["Complex", ["Rational", 3, 5], ["Rational", 1, 5]]);
  exactJson(["DirichletL", 3, 2, 0], ["Rational", 1, 3]);
  exactJson(["DirichletL", 3, 2, -2], ["Rational", -2, 9]);
  exactJson(["DirichletL", 5, 2, -1], 0);
  exactJson(["DirichletL", 8, 2, -1], -1);
  exactJson(["DirichletL", 8, 2, -3], 11);
  exactJson(["DirichletL", 5, 3, -3], 2);
});

test("L(s, χ) numerically, including the critical strip and near s = 1", () => {
  const c = ce.box(["DirichletL", 5, 2, 2]).N();
  expect(c.re).toBeCloseTo(0.9587161227168813, 12);
  expect(c.im).toBeCloseTo(0.14556587678508906, 12);
  // Just off the removable point: a non-principal L has no pole there, and the Laurent
  // route keeps the digits the ζ(s, r/k) sum would cancel away.
  expect(num(["DirichletL", 4, 2, 1.0001])).toBeCloseTo(0.7854174527578408, 11);
});

// --- The third argument on Gamma / GammaRegularized ---------------------------------

test("Gamma keeps its native one- and two-argument behaviour", () => {
  exactJson(["Gamma", 5], ["Gamma", 5]); // exact integer stays symbolic, as in vanilla CE
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
  // Negative s, where Γ(s, 0) and Γ(s) are both infinite but the regularized ratio is 1.
  expect(num(["GammaRegularized", -1.5, 0, 1.5])).toBeCloseTo(0.985260074360347, 13);
  expect(num(["GammaRegularized", 2.5, 0, 1.5])).toBeCloseTo(0.3000141641213725, 13);
});

test("Γ(1, z) = e^{−z}, so Γ(1, 0, z) collapses to 1 − e^{−z} (Wolfram's reduction)", () => {
  sameExact(["Gamma", 1, "z"], ["Exp", ["Negate", "z"]]);
  sameExact(["Gamma", 1, 0, "z"], ["Subtract", 1, ["Exp", ["Negate", "z"]]]);
  expect(num(["Gamma", 1, 0, 2.0])).toBeCloseTo(1 - Math.exp(-2), 14);
});

test("a three-argument call that cannot reduce keeps its own form", () => {
  // Γ(2, 0, z): Wolfram leaves this as Gamma[2, 0, z] too — the difference of two
  // unevaluated calls would be worse than the call itself.
  exactJson(["Gamma", 2, 0, "z"], ["Gamma", 2, 0, "z"]);
  exactJson(["Gamma", "s", 0, "z"], ["Gamma", "s", 0, "z"]);
});

test("Q(s, z) = Γ(s, z)/Γ(s) covers the complex arguments the native handler declines", () => {
  const c = ce.box(["GammaRegularized", ["Complex", 2, 1], 1.5]).N();
  expect(c.re).toBeCloseTo(0.6176522310450633, 12);
  expect(c.im).toBeCloseTo(0.3334815406585526, 12);
});
