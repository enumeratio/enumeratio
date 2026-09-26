import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// IncompleteEllipticF, IncompleteEllipticE — Fungrim's names for compute-engine's native
// two-argument EllipticF(φ, m) / EllipticE(φ, m). IncompleteEllipticPi(n, φ, m) is a
// from-scratch Carlson R_F/R_J evaluator (native EllipticPi's own 3-argument incomplete
// form NaNs at some complex φ — see the direct test below). Numeric evaluation is held to
// the oracle values in elliptic.golden.json, gathered from mpmath (ellipf/ellipe/ellippi)
// and a Wolfram kernel by scripts/collect-elliptic-goldens.ts (neither is needed to run
// this file).
//
// EllipticE(m)'s own complex-modulus precision fix (design/upstreaming.md §8) moved to
// @enumeratio/for-compute-engine's elliptic-e-complex patch, offered upstream as
// cortex-js/compute-engine#346/#348 — declareElliptic below applies it in the same spot
// it used to run in.

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

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./elliptic.golden.json", import.meta.url), "utf8"));

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
  // EllipticE's own complex-modulus cases moved to @enumeratio/for-compute-engine's
  // elliptic-e-complex patch tests, with the patch (design/upstreaming.md §10).
  const heads = new Set(goldens.map((g) => g.head));
  expect([...heads].sort()).toEqual(["IncompleteEllipticE", "IncompleteEllipticF", "IncompleteEllipticPi"].sort());
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
  expect(ce.box(["IncompleteEllipticF", "x", "y"]).evaluate().json).toEqual(["IncompleteEllipticF", "x", "y"]);
  expect(ce.box(["IncompleteEllipticF", 0.5, 0.3]).evaluate().re).toBeCloseTo(0.5061402119623554, 12);
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

test("IncompleteEllipticPi stays symbolic under plain evaluate; a float argument evaluates numerically", () => {
  expect(ce.box(["IncompleteEllipticPi", "n", "phi", "m"]).evaluate().json).toEqual([
    "IncompleteEllipticPi",
    "n",
    "phi",
    "m",
  ]);
  expect(ce.box(["IncompleteEllipticPi", 0.5, 0.4, 0.3]).evaluate().re).toBeCloseTo(0.4141517368244767, 12);
});

test("IncompleteEllipticPi computes complex φ directly via Carlson, where native EllipticPi returns NaN", () => {
  // n = 0.2, φ = 1.2 + 0.5i, m = 0.3 is well inside Re(φ) ∈ [-π/2, π/2] (Fungrim 8f4e31's
  // own validity region), yet compute-engine's native three-argument EllipticPi returns
  // NaN there — a native bug, not a domain limit. Pinned against mpmath's ellippi.
  const native = ce.box(["EllipticPi", 0.2, ["Complex", 1.2, 0.5], 0.3]).N();
  expect(Number.isNaN(native.re)).toBe(true);
  const v = ce.box(["IncompleteEllipticPi", 0.2, ["Complex", 1.2, 0.5], 0.3]).N();
  expect(v.re).toBeCloseTo(1.321415376117118, 9);
  expect(v.im).toBeCloseTo(0.7186657188751805, 9);
});

test("IncompleteEllipticPi answers at Fungrim 5f84d9's quasi-periodicity, n = m complex, φ shifted by kπ", () => {
  // Regression: this used to decline (riskyRJ in elliptic.ts blanket-declined any R_J call
  // with p alone at Re < 0 once complex). n = m makes the shifted-φ R_J call's p land
  // exactly on x, y, or z (carlsonRJDeclines's own exemption — see carlson.ts), and the
  // fixed carlsonRJ answers correctly there regardless of sign pattern. Pinned against
  // mpmath's ellippi.
  const nm = ["Complex", 1.17, 0.45] as const;
  const phi = ["Add", ["Complex", 1.17, 0.45], ["Multiply", 3, "Pi"]] as const;
  const v = ce.box(["IncompleteEllipticPi", nm, phi, nm]).N();
  expect(v.re).toBeCloseTo(-0.103480823340677958646514658117, 9);
  expect(v.im).toBeCloseTo(15.1133814653099445550739326363, 9);
});

test("IncompleteEllipticPi quasi-periodicity: Π(n; φ+2π, m) = 4·Π(n,m) + Π(n; φ, m)", () => {
  const n = 0.4;
  const m = 0.35;
  const phi = 0.6;
  const shifted = ce.box(["IncompleteEllipticPi", n, phi + 2 * Math.PI, m]).N();
  const base = ce.box(["IncompleteEllipticPi", n, phi, m]).N();
  const complete = ce.box(["EllipticPi", n, m]).N();
  expect(shifted.re).toBeCloseTo(4 * complete.re + base.re, 9);
});
