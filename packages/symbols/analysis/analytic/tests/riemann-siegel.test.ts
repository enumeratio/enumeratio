import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// RiemannSiegelTheta, RiemannSiegelZ, RiemannZetaZero. Held to the oracle values in
// riemann-siegel.golden.json, gathered by scripts/collect-riemann-siegel-goldens.ts from
// mpmath (`siegeltheta`, `siegelz`, `zetazero`) and a Wolfram kernel (`RiemannSiegelTheta`,
// `RiemannSiegelZ`, `ZetaZero`) — neither is needed to run this file. Both reuse the
// existing log-gamma (loggamma.ts) and generalized-zeta (hurwitz-zeta.ts) kernels, so this
// file is only pinning the theta/Z/zero-finding logic layered on top of them.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface ThetaZCase {
  label: string;
  head: "RiemannSiegelTheta" | "RiemannSiegelZ";
  t: number;
  tol: number;
  mpmath?: number;
  wolfram?: number;
}
interface ZeroCase {
  label: string;
  k: number;
  tol: number;
  mpmath?: number;
  wolfram?: number;
}

const goldens: { thetaZ: ThetaZCase[]; zeros: ZeroCase[] } = JSON.parse(
  readFileSync(new URL("./riemann-siegel.golden.json", import.meta.url), "utf8"),
);

test("RiemannSiegelTheta/RiemannSiegelZ: every golden case matches the oracles under N()", () => {
  const off: string[] = [];
  for (const g of goldens.thetaZ) {
    const ours = ce.box([g.head, g.t]).N().re;
    expect(g.mpmath ?? g.wolfram, g.label).toBeDefined();
    for (const [name, ref] of [
      ["mpmath", g.mpmath],
      ["wolfram", g.wolfram],
    ] as const) {
      if (ref === undefined) continue;
      const err = Math.abs(ours - ref) / Math.max(1, Math.abs(ref));
      if (!(err <= g.tol)) off.push(`${g.label} vs ${name}: ours=${ours} ref=${ref}`);
    }
  }
  expect(off).toEqual([]);
});

test("RiemannZetaZero: every golden k matches the oracles' t_k, real part exactly 1/2", () => {
  const off: string[] = [];
  for (const g of goldens.zeros) {
    const z = ce.box(["RiemannZetaZero", g.k]).N();
    expect(z.re, g.label).toBe(0.5);
    expect(g.mpmath ?? g.wolfram, g.label).toBeDefined();
    for (const [name, ref] of [
      ["mpmath", g.mpmath],
      ["wolfram", g.wolfram],
    ] as const) {
      if (ref === undefined) continue;
      const err = Math.abs(z.im - ref) / Math.max(1, Math.abs(ref));
      if (!(err <= g.tol)) off.push(`${g.label} vs ${name}: ours=${z.im} ref=${ref}`);
    }
  }
  expect(off).toEqual([]);
});

test("RiemannSiegelTheta(0) is exact — no N() needed", () => {
  expect(ce.box(["RiemannSiegelTheta", 0]).evaluate().json).toEqual(0);
});

test("RiemannZetaZero declines (stays symbolic) for k < 1", () => {
  expect(ce.box(["RiemannZetaZero", 0]).N().operator).toBe("RiemannZetaZero");
  expect(ce.box(["RiemannZetaZero", -1]).N().operator).toBe("RiemannZetaZero");
});

test("RiemannZetaZero rejects a non-integer k as a type error, per its declared signature", () => {
  expect(ce.box(["RiemannZetaZero", 1.5]).N().operator).toBe("Error");
});
