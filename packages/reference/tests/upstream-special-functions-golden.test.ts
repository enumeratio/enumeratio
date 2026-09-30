import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches } from "@enumeratio/ce-patches/src";

// The full oracle comparison for BarnesG, LogBarnesG, LogGamma, ClausenCl, DirichletEta,
// DirichletBeta, StieltjesGamma, DirichletCharacter, and DirichletL -- held against
// golden/upstream/dirichlet-barnes-loggamma-clausen-stieltjes.golden.json, which
// scripts/collect-special-goldens.ts gathers from mpmath and a Wolfram kernel (neither is
// needed to run this file). A curated handful of these points also lives beside the code,
// in packages/ce-patches/tests/dirichlet-barnes-loggamma-clausen-stieltjes.test.ts.

const ce = new ComputeEngine();
applyAllPatches(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(
    new URL("../golden/upstream/dirichlet-barnes-loggamma-clausen-stieltjes.golden.json", import.meta.url),
    "utf8",
  ),
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

test("the golden file covers every moved head", () => {
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].toSorted()).toEqual(
    [
      "BarnesG",
      "ClausenCl",
      "DirichletBeta",
      "DirichletCharacter",
      "DirichletEta",
      "DirichletL",
      "LogBarnesG",
      "LogGamma",
      "StieltjesGamma",
    ].toSorted(),
  );
});
