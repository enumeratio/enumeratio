import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// MultiZetaValue(s1, s2) — see multizeta.ts for the partial-sum + Zeta-tail summation.
// Golden values are a fast mpmath partial-sum + tail (same method, at 50-digit
// precision) rather than mpmath's generic `nsum`, which does not converge in
// reasonable time on a nested nsum over this series. The exact closed forms Fungrim
// declares (fungrim:62de01 etc.) are checked directly below, independent of mpmath.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./multizeta.golden.json", import.meta.url), "utf8"));

test("MultiZetaValue matches the oracle partial-sum", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const err = Math.abs(r.re - g.mpmath[0]);
    if (!(err <= g.tol)) off.push(`${g.label}: got ${r.re}, expected ${g.mpmath[0]} (err ${err})`);
  }
  expect(off).toEqual([]);
});

const zeta = (s: number): number => ce.box(["Zeta", s]).N().re;
const mzv = (s1: number, s2: number): number => ce.box(["MultiZetaValue", s1, s2]).N().re;

test("Fungrim's exact closed forms", () => {
  // fungrim:62de01 — ζ(2,2) = ¾ζ(4)
  expect(mzv(2, 2)).toBeCloseTo(0.75 * zeta(4), 9);
  // fungrim:3a5167 — ζ(3,3) = ½(ζ(3)² − ζ(6))
  expect(mzv(3, 3)).toBeCloseTo(0.5 * (zeta(3) ** 2 - zeta(6)), 9);
  // fungrim:856317 — ζ(2,3) = 9/2 ζ(5) − 2ζ(2)ζ(3)
  expect(mzv(2, 3)).toBeCloseTo(4.5 * zeta(5) - 2 * zeta(2) * zeta(3), 9);
  // fungrim:a5e52e — ζ(3,2) = 3ζ(2)ζ(3) − 11/2 ζ(5)
  expect(mzv(3, 2)).toBeCloseTo(3 * zeta(2) * zeta(3) - 5.5 * zeta(5), 9);
  // fungrim:ef2c71 — ζ(4,2) = ζ(3)² − 4/3 ζ(6)
  expect(mzv(4, 2)).toBeCloseTo(zeta(3) ** 2 - (4 / 3) * zeta(6), 9);
  // fungrim:da71d3 (Euler's reflection) — ζ(a)ζ(b) − ζ(a+b) = ζ(a,b) + ζ(b,a)
  for (const [a, b] of [
    [2, 3],
    [3, 2],
    [2, 4],
    [4, 2],
  ]) {
    expect(zeta(a) * zeta(b) - zeta(a + b)).toBeCloseTo(mzv(a, b) + mzv(b, a), 9);
  }
});

test("declines s1 or s2 below 2", () => {
  expect(ce.box(["MultiZetaValue", 1, 2]).N().operator).toBe("MultiZetaValue");
  expect(ce.box(["MultiZetaValue", 2, 1]).N().operator).toBe("MultiZetaValue");
});
