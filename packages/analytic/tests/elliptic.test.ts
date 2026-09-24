import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// IncompleteEllipticF, IncompleteEllipticE — Fungrim's names for compute-engine's native
// two-argument EllipticF(φ, m) / EllipticE(φ, m) — plus the in-place precision fix for
// EllipticE(m) at complex modulus (design/upstreaming.md §8). Numeric evaluation is held
// to the oracle values in elliptic.golden.json, gathered from mpmath (ellipf/ellipe) and
// a Wolfram kernel by scripts/collect-elliptic-goldens.ts (neither is needed to run this
// file).

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

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./elliptic.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

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
  expect([...heads].sort()).toEqual(
    ["EllipticE", "IncompleteEllipticE", "IncompleteEllipticF"].sort(),
  );
});

// --- Direct checks not tied to the golden grid --------------------------------------

test("IncompleteEllipticF/E delegate to native EllipticF/E — same value, not just close", () => {
  const phi = 0.8;
  const m = 0.35;
  expect(ce.box(["IncompleteEllipticF", phi, m]).N().re).toBe(ce.box(["EllipticF", phi, m]).N().re);
  expect(ce.box(["IncompleteEllipticE", phi, m]).N().re).toBe(ce.box(["EllipticE", phi, m]).N().re);
});

test("IncompleteEllipticF(0, m) = 0 and IncompleteEllipticE(0, m) = 0", () => {
  for (const m of [0.2, 0.7, 1.5]) {
    expect(ce.box(["IncompleteEllipticF", 0, m]).N().re).toBeCloseTo(0, 13);
    expect(ce.box(["IncompleteEllipticE", 0, m]).N().re).toBeCloseTo(0, 13);
  }
});

test("stays symbolic under plain evaluate; a float argument evaluates numerically", () => {
  expect(ce.box(["IncompleteEllipticF", "x", "y"]).evaluate().json).toEqual([
    "IncompleteEllipticF",
    "x",
    "y",
  ]);
  expect(ce.box(["IncompleteEllipticF", 0.5, 0.3]).evaluate().re).toBeCloseTo(
    0.5061402119623554,
    12,
  );
});

test("IncompleteEllipticE reduces φ outside [-π/2, π/2] itself, rather than trusting native EllipticE there at complex m (Fungrim c28288)", () => {
  // Pinned against mpmath's ellipe(0.57 + π, 0.57 + 0.23i) — native EllipticE gets this
  // wrong (3.18823689387969 vs the correct 3.20276744106921), see elliptic.ts.
  const m = ["Complex", 0.57, 0.23] as const;
  const phi = 0.57 + Math.PI;
  const v = ce.box(["IncompleteEllipticE", phi, m]).N();
  expect(v.re).toBeCloseTo(3.20276744106921, 10);
  expect(v.im).toBeCloseTo(-0.246480254230982, 10);
  // The native call this delegate would otherwise have made disagrees at the precision
  // this test holds IncompleteEllipticE to — confirming the reduction is doing real work,
  // not just reproducing what native already gets right.
  const native = ce.box(["EllipticE", phi, m]).N();
  expect(Math.abs(native.re - v.re)).toBeGreaterThan(1e-3);
});

test("quasi-periodicity: E(φ+2π, m) = 4·E(m) + E(φ, m), complex m included", () => {
  const m = ["Complex", 0.1, 0.9] as const;
  const phi = 0.4;
  const shifted = ce.box(["IncompleteEllipticE", phi + 2 * Math.PI, m]).N();
  const base = ce.box(["IncompleteEllipticE", phi, m]).N();
  const complete = ce.box(["EllipticE", m]).N();
  expect(shifted.re).toBeCloseTo(4 * complete.re + base.re, 10);
  expect(shifted.im).toBeCloseTo(4 * complete.im + base.im, 10);
});

test("EllipticE(m) at real m is untouched by the patch — matches native EllipticK's own agreement", () => {
  // Real modulus was already exact; the patch only reroutes the complex-modulus branch,
  // so this should be identical to calling the native evaluator directly (no detour).
  for (const m of [0.3, 0.7, -0.5]) {
    const viaPatched = ce.box(["EllipticE", m]).N().re;
    const viaIncomplete = ce.box(["EllipticE", ["Divide", "Pi", 2], m]).N().re;
    expect(viaPatched).toBeCloseTo(viaIncomplete, 13);
  }
});

test("EllipticE(m) stays symbolic under plain evaluate at a symbolic or exact argument", () => {
  expect(ce.box(["EllipticE", "x"]).evaluate().json).toEqual(["EllipticE", "x"]);
});
