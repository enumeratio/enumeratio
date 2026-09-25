import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// BesselJZero(ν, k) — see bessel-zeros.ts for the series + McMahon-seeded bisection.
// Golden values are mpmath's `besseljzero`, which compute-engine's own `BesselJ` cannot
// be checked against directly since it only evaluates numerically at integer order.

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
  readFileSync(new URL("./bessel-zeros.golden.json", import.meta.url), "utf8"),
);

test("BesselJZero matches mpmath.besseljzero", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const err = Math.abs(r.re - g.mpmath[0]);
    if (!(err <= g.tol)) off.push(`${g.label}: got ${r.re}, expected ${g.mpmath[0]} (err ${err})`);
  }
  expect(off).toEqual([]);
});

test("BesselJZero(3/2, 1) is the sinc function's first positive turning point", () => {
  // fungrim:da7fb1 / fungrim:1e6344: Sinc's minimum is at x = j_{3/2,1}, since
  // Sinc'(x) = 0 ⟺ tan(x) = x, the same condition that locates j_{3/2,1}.
  const x = ce.box(["BesselJZero", ["Rational", 3, 2], 1]).N().re;
  const tanX = Math.tan(x);
  expect(Math.abs(tanX - x) / x).toBeLessThan(1e-8);
});

test("declines out-of-domain operands rather than guessing", () => {
  expect(ce.box(["BesselJZero", -1, 1]).N().operator).toBe("BesselJZero");
  expect(ce.box(["BesselJZero", 1.5, 0]).N().operator).toBe("BesselJZero");
});
