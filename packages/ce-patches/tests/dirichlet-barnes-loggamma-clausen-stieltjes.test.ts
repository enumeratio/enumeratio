import { ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import {
  barnesG,
  logBarnesG,
  mul as mulCx,
  character,
  eulerPhi,
  clausen,
  applyAllPatches,
  logGamma,
  stieltjesGamma,
} from "../src/index.ts";

// A curated handful of points for BarnesG, LogBarnesG, LogGamma, ClausenCl, StieltjesGamma,
// DirichletCharacter and DirichletL -- edges, identities, and a branch check for each. The
// full oracle comparison (mpmath and a Wolfram kernel, gathered by
// packages/reference/scripts/collect-special-goldens.ts) lives beside the reference entries,
// in packages/reference/tests/upstream-special-functions-golden.test.ts.

const ce = new ComputeEngine();
applyAllPatches(ce);

describe("BARNES G FUNCTION", () => {
  test("G(30) is far past double, an exact big integer", () => {
    // G(30) = Π_{k≤28} k! — far past double; an exact big integer.
    const g30 = ce.box(["BarnesG", 30]).evaluate();
    expect(isNumber(g30)).toBe(true);
    expect(g30.re).toBeGreaterThan(1e300);
  });

  test("G vanishes at the nonpositive integers; ln G is −∞ there", () => {
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
});

describe("LOG GAMMA", () => {
  test("LogGamma is the continuation, not the principal log of Γ (Wolfram convention)", () => {
    // LogGamma[-2.5 + 1.5 I] = -3.7175… - 7.7131 I, where Log[Gamma[…]] has imaginary part -1.43.
    const v = logGamma({ re: -2.5, im: 1.5 });
    expect(v.re).toBeCloseTo(-3.7175134511917927, 12);
    expect(v.im).toBeCloseTo(-7.7130655258341925, 12);
  });
});

describe("CLAUSEN FUNCTIONS", () => {
  test("the kernel's 2π periodicity / oddness", () => {
    expect(clausen(2, 1 + 2 * Math.PI)).toBeCloseTo(clausen(2, 1), 14);
    expect(clausen(2, -1)).toBeCloseTo(-clausen(2, 1), 14);
    expect(clausen(3, -1)).toBeCloseTo(clausen(3, 1), 14);
    expect(clausen(1, 1)).toBeCloseTo(-Math.log(Math.abs(2 * Math.sin(0.5))), 14);
  });

  test("Cl₂(π/3) = 1.0149416064096536…, the maximum of Cl₂", () => {
    expect(clausen(2, Math.PI / 3)).toBeCloseTo(1.0149416064096535, 13);
  });
});

describe("STIELTJES GAMMA", () => {
  test("the shift identity γ_n(a+1) = γ_n(a) − lnⁿ(a)/a", () => {
    // ζ(s, a+1) = ζ(s, a) − a^{−s} ⇒ γ_n(a+1) = γ_n(a) − lnⁿ(a)/a; at a = 1 the correction is 0 for n ≥ 1.
    expect(stieltjesGamma(3, { re: 2, im: 0 }).re).toBeCloseTo(stieltjesGamma(3, { re: 1, im: 0 }).re, 14);
    const a = { re: 0.5, im: 0 };
    expect(stieltjesGamma(2, { re: 1.5, im: 0 }).re).toBeCloseTo(
      stieltjesGamma(2, a).re - Math.log(0.5) ** 2 / 0.5,
      13,
    );
  });
});

describe("DIRICHLET CHARACTER / DIRICHLET L", () => {
  test("the table is orthogonal: Σ_n χ_j(n) = 0 for a non-principal χ, φ(k) for the principal one", () => {
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
});
