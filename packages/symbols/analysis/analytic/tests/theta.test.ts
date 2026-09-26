import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// EllipticTheta(a,u,q) and EllipticThetaPrime(a,u,q), a = 1..4 — Wolfram's nome
// convention |q| < 1 (matches mpmath.jtheta(n,z,q)). Direct q-series, held to the oracle
// values in theta.golden.json, gathered from mpmath and a Wolfram kernel by
// scripts/collect-theta-goldens.ts (neither oracle is needed to run this file).

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: [number, number];
  wolfram?: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./theta.golden.json", import.meta.url), "utf8"));

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

test("the golden file covers every head", () => {
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].sort()).toEqual(["EllipticTheta", "EllipticThetaPrime"].sort());
});

test("stays symbolic under plain evaluate at symbolic operands; a float argument evaluates numerically", () => {
  expect(ce.box(["EllipticTheta", 3, "u", "q"]).evaluate().json).toEqual(["EllipticTheta", 3, "u", "q"]);
  expect(ce.box(["EllipticTheta", 3, 0.3, 0.2]).evaluate().re).toBeCloseTo(1.3312935581135865, 10);
});

test("|q| >= 1 is declined", () => {
  expect(ce.box(["EllipticTheta", 3, 0.3, 1.0]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 3, 0.3, 1.5]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 3, 0.3, ["Complex", 0.9, 0.9]]).N().operator).toBe("EllipticTheta");
});

test("a must be a concrete integer 1..4", () => {
  expect(ce.box(["EllipticTheta", 5, 0.3, 0.2]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", 0, 0.3, 0.2]).N().operator).toBe("EllipticTheta");
  expect(ce.box(["EllipticTheta", "a", 0.3, 0.2]).N().operator).toBe("EllipticTheta");
});

test("theta3(0,q) and theta4(0,q) are the classical q-series values", () => {
  // theta3(0, 0.5) = 1 + 2*sum(0.5^(n^2)) — a hand-checkable case independent of the
  // golden file (see the file header for the mpmath cross-check at complex points).
  const q = 0.5;
  let expected3 = 1;
  let expected4 = 1;
  for (let n = 1; n <= 30; n++) {
    expected3 += 2 * q ** (n * n);
    expected4 += 2 * (n % 2 === 0 ? 1 : -1) * q ** (n * n);
  }
  expect(ce.box(["EllipticTheta", 3, 0, q]).N().re).toBeCloseTo(expected3, 12);
  expect(ce.box(["EllipticTheta", 4, 0, q]).N().re).toBeCloseTo(expected4, 12);
});

test("theta1(0,q) = 0 for any q — theta1 is an odd function of u", () => {
  for (const q of [0.1, 0.5, -0.3]) {
    expect(ce.box(["EllipticTheta", 1, 0, q]).N().re).toBeCloseTo(0, 12);
  }
});
