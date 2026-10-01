import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";

// The full oracle comparison for EllipticE(m) at a complex modulus -- golden values gathered
// from mpmath (ellipe) and a Wolfram kernel by @enumeratio/analytic's
// scripts/collect-elliptic-goldens.ts, moved here with the patch. compute-engine 0.139 shipped this fix natively, so the ce-patches
// elliptic-e-complex patch was retired -- this now checks native EllipticE directly.

const ce = new ComputeEngine();

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("../golden/upstream/elliptic-e-complex.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

test(`EllipticE: ${goldens.length} complex-modulus cases match the oracles`, () => {
  const off: string[] = [];
  for (const g of goldens) {
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
