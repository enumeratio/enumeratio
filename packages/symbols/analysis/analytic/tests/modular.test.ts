import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// ModularJ, ModularLambda, EisensteinG — see modular.ts for the SL2(Z) reduction and
// back-transform each delegates through to compute-engine's native EisensteinE /
// JacobiTheta. Numeric evaluation is held to the oracle values in modular.golden.json,
// which scripts/collect-modular-goldens.ts gathers from mpmath (kleinj, jtheta, and a
// direct q-series for EisensteinG) and a Wolfram kernel (neither is needed to run this
// file). A few exact known values — j(i) = 1728, j(ρ) = 0, λ(i) = 1/2 — are checked
// directly below, since they hold identically rather than merely to a tolerance.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const num = (input: Expr): number => ce.box(input).N().re;
const im = (input: Expr): number => ce.box(input).N().im;

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./modular.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

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

test("ModularJ(i) = 1728 exactly (E6(i) = 0)", () => {
  expect(num(["ModularJ", ["Complex", 0, 1]])).toBeCloseTo(1728, 6);
  expect(im(["ModularJ", ["Complex", 0, 1]])).toBeCloseTo(0, 6);
});

test("ModularJ(ρ) = 0 exactly (E4(ρ) = 0), ρ = e^{2πi/3}", () => {
  const rho: Expr = ["Complex", -0.5, Math.sqrt(3) / 2];
  expect(num(["ModularJ", rho])).toBeCloseTo(0, 4);
  expect(im(["ModularJ", rho])).toBeCloseTo(0, 4);
});

test("ModularLambda(i) = 1/2 exactly", () => {
  expect(num(["ModularLambda", ["Complex", 0, 1]])).toBeCloseTo(0.5, 9);
  expect(im(["ModularLambda", ["Complex", 0, 1]])).toBeCloseTo(0, 9);
});

test("ModularJ is SL2(Z)-invariant: j(τ) = j(τ+1) = j(−1/τ)", () => {
  const tau: Expr = ["Complex", 0.3, 1.1];
  const tauPlus1: Expr = ["Complex", 1.3, 1.1];
  const negInvTau: Expr = ["Complex", -0.3 / (0.3 ** 2 + 1.1 ** 2), 1.1 / (0.3 ** 2 + 1.1 ** 2)];
  const j0 = num(["ModularJ", tau]);
  const j1 = num(["ModularJ", tauPlus1]);
  const j2 = num(["ModularJ", negInvTau]);
  expect(j1).toBeCloseTo(j0, 6);
  expect(j2).toBeCloseTo(j0, 6);
});

test("ModularLambda's own transform laws: λ(τ+1) = λ/(λ−1), λ(−1/τ) = 1−λ", () => {
  const re = 0.3;
  const imPart = 1.1;
  const tau: Expr = ["Complex", re, imPart];
  const lam0re = num(["ModularLambda", tau]);
  const lam0im = im(["ModularLambda", tau]);

  const tauPlus1: Expr = ["Complex", re + 1, imPart];
  const lam1re = num(["ModularLambda", tauPlus1]);
  const lam1im = im(["ModularLambda", tauPlus1]);
  // λ/(λ−1) computed by hand from (lam0re, lam0im)
  const denRe = lam0re - 1;
  const denIm = lam0im;
  const denAbs2 = denRe * denRe + denIm * denIm;
  const expectRe1 = (lam0re * denRe + lam0im * denIm) / denAbs2;
  const expectIm1 = (lam0im * denRe - lam0re * denIm) / denAbs2;
  expect(lam1re).toBeCloseTo(expectRe1, 6);
  expect(lam1im).toBeCloseTo(expectIm1, 6);

  const d = re * re + imPart * imPart;
  const negInvTau: Expr = ["Complex", -re / d, imPart / d];
  const lam2re = num(["ModularLambda", negInvTau]);
  const lam2im = im(["ModularLambda", negInvTau]);
  expect(lam2re).toBeCloseTo(1 - lam0re, 6);
  expect(lam2im).toBeCloseTo(-lam0im, 6);
});

test("ModularJ keeps its digits far up the imaginary axis (Heegner 163)", () => {
  const tau = ["Multiply", ["Rational", 1, 2], ["Add", 1, ["Complex", 0, ["Sqrt", 163]]]];
  const j = ce.box(["ModularJ", tau] as never).N().re;
  expect(Math.abs(j / -(640320 ** 3) - 1)).toBeLessThan(1e-12);
});
