import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Gamma / GammaRegularized's generalized (three-argument) incomplete-gamma extension, and
// HarmonicNumber -- the heads special-functions.ts still declares directly (the zeta-family
// cousins that moved upstream as #340 patches -- BarnesG, LogGamma, ClausenCl, the Dirichlet
// family, StieltjesGamma -- have their own tests in upstream/compute-engine/tests/). Numeric
// evaluation is held to the oracle values in special-functions.golden.json, gathered by
// scripts/collect-special-goldens.ts from mpmath and a Wolfram kernel.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const exactJson = (input: Expr, expected: unknown) => expect(ce.box(input).evaluate().json).toEqual(expected);
const num = (input: Expr): number => ce.box(input).N().re;

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

test("the golden file covers every head still declared here", () => {
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].sort()).toEqual(["Gamma", "GammaRegularized", "HarmonicNumber"].sort());
});

// --- Catalan -------------------------------------------------------------------------

test("Catalan is a held numeric constant, like EulerGamma", () => {
  exactJson("Catalan", "Catalan");
  expect(num("Catalan")).toBeCloseTo(0.915965594177219, 15);
});
