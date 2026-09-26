import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, ellipticEComplex } from "../src/index.ts";

// EllipticE(m) at a complex modulus. Golden values gathered from mpmath (ellipe) and a
// Wolfram kernel by @enumeratio/analytic's scripts/collect-elliptic-goldens.ts, moved here
// with the patch (design/upstreaming.md §10).

const ce = new ComputeEngine();
applyPatch(ce, ellipticEComplex);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./elliptic-e-complex.golden.json", import.meta.url), "utf8"),
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

test("EllipticE(m) at real m is untouched by the patch -- matches the two-argument reduction", () => {
  for (const m of [0.3, 0.7, -0.5]) {
    const viaPatched = ce.box(["EllipticE", m]).N().re;
    const viaIncomplete = ce.box(["EllipticE", ["Divide", "Pi", 2], m]).N().re;
    expect(viaPatched).toBeCloseTo(viaIncomplete, 13);
  }
});

test("EllipticE(m) stays symbolic under plain evaluate at a symbolic or exact argument", () => {
  expect(ce.box(["EllipticE", "x"]).evaluate().json).toEqual(["EllipticE", "x"]);
});

test("applying twice is a no-op", () => {
  applyPatch(ce, ellipticEComplex);
  const r = ce.box(["EllipticE", ce.complex(0.57, 0.23)]).N();
  expect(r.re).toBeCloseTo(1.3248077726970517, 10);
});
