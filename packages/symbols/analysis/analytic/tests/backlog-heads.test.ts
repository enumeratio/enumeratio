import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// The ten backlog heads landed in this pass — ExpIntegralE, LambertW (branches other than
// 0/-1), InverseErfc, InverseGammaRegularized, InverseBetaRegularized, BellY, NorlundB,
// PrimeZetaP, HypergeometricPFQ, KleinInvariantJ. Golden values are a Wolfram kernel
// (collect-backlog-goldens.ts); the exact symbolic identities each head also carries are
// checked directly in the reference examples (packages/reference), not repeated here.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./backlog-heads.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

test("the backlog heads landed this pass match a Wolfram kernel", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const ours: [number, number] = [r.re, r.im];
    if (!g.wolfram) continue;
    const err = relErr(ours, g.wolfram);
    if (!(err <= g.tol)) off.push(`${g.label}: relerr ${err.toExponential(2)} (tol ${g.tol})`);
  }
  expect(off).toEqual([]);
});

test("LambertW(z, 0) and LambertW(z, -1) still go through compute-engine's native handler", () => {
  // Branches this package does not touch — regression guard against the wrapper ever
  // shadowing them.
  expect(ce.box(["LambertW", -0.14, 0]).N().re).toBeCloseTo(-0.165137789266952, 12);
  expect(ce.box(["LambertW", -0.14, -1]).N().re).toBeCloseTo(-3.0963305842625411, 10);
});

test("HypergeometricPFQ declines outside the unit disc when p = q + 1", () => {
  expect(ce.box(["HypergeometricPFQ", ["List", 1, 1], ["List", 2], 1.5]).N().operator).toBe(
    "HypergeometricPFQ",
  );
});

test("PrimeZetaP declines at and below the convergence boundary", () => {
  expect(ce.box(["PrimeZetaP", 1]).N().operator).toBe("PrimeZetaP");
  expect(ce.box(["PrimeZetaP", 0.5]).N().operator).toBe("PrimeZetaP");
});

test("InverseGammaRegularized and InverseBetaRegularized decline outside their domain", () => {
  expect(ce.box(["InverseGammaRegularized", -1, 0.5]).N().operator).toBe("InverseGammaRegularized");
  expect(ce.box(["InverseBetaRegularized", 1.5, 2, 3]).N().operator).toBe("InverseBetaRegularized");
});
