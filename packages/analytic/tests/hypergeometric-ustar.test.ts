import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// HypergeometricUStar(a,b,z) = z^a·U(a,b,z) — see hypergeometric-ustar.ts for Kummer's
// connection formula. Golden values are mpmath's `z**a * hyperu(a,b,z)`.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./hypergeometric-ustar.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

test("HypergeometricUStar matches mpmath.hyperu", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const err = relErr([r.re, r.im], g.mpmath);
    if (!(err <= g.tol)) off.push(`${g.label}: relerr ${err.toExponential(2)}`);
  }
  expect(off).toEqual([]);
});

test("declines z = 0 and (near-)integer b", () => {
  expect(ce.box(["HypergeometricUStar", 1, 2, 0]).N().operator).toBe("HypergeometricUStar");
  expect(ce.box(["HypergeometricUStar", 1, 2, 3]).N().operator).toBe("HypergeometricUStar");
});
