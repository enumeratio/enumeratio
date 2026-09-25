import { readFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// ChebyshevT, ChebyshevU, LegendrePolynomial, RisingFactorial — the Fungrim frontier's top
// four undeclared heads. Numeric values are pinned against a Wolfram kernel (a fixed golden
// file, not re-collected here — see orthogonal-polynomials.golden.json); the exact-integer
// path is pinned directly against T_n(cos t) = cos(nt) and the standard low-degree
// polynomials, which need no oracle.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const exactJson = (input: Expr, expected: unknown) => expect(ce.box(input).evaluate().json).toEqual(expected);
const sameExact = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

// --- Golden numeric values (Wolfram kernel) -----------------------------------------

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  wolfram: [number, number];
}

const goldens: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./orthogonal-polynomials.golden.json", import.meta.url), "utf8"),
);

const relErr = (ours: [number, number], ref: [number, number]): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

test("matches a Wolfram kernel on every golden case", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box([g.head, ...g.args] as never).N();
    const err = relErr([r.re, r.im], g.wolfram);
    if (!(err <= 1e-9)) off.push(`${g.label}: relerr ${err.toExponential(2)}`);
  }
  expect(off).toEqual([]);
});

// --- ChebyshevT / ChebyshevU exact integer path -------------------------------------

test("T_n(cos t) = cos(nt), exactly at t = 0 and t = π (x = ±1)", () => {
  for (let n = 0; n <= 6; n++) {
    exactJson(["ChebyshevT", n, 1], 1); // cos(0) = 1 for every n
    exactJson(["ChebyshevT", n, -1], n % 2 === 0 ? 1 : -1); // cos(nπ)
  }
});

test("low-degree ChebyshevT / ChebyshevU polynomials, exactly, at a symbol", () => {
  sameExact(["ChebyshevT", 0, "x"], 1);
  sameExact(["ChebyshevT", 1, "x"], "x");
  sameExact(["ChebyshevT", 2, "x"], ["Subtract", ["Multiply", 2, ["Power", "x", 2]], 1]);
  sameExact(["ChebyshevT", 3, "x"], ["Subtract", ["Multiply", 4, ["Power", "x", 3]], ["Multiply", 3, "x"]]);
  sameExact(["ChebyshevU", 0, "x"], 1);
  sameExact(["ChebyshevU", 1, "x"], ["Multiply", 2, "x"]);
  sameExact(["ChebyshevU", 2, "x"], ["Subtract", ["Multiply", 4, ["Power", "x", 2]], 1]);
});

test("negative order folds per Wolfram: T_{-n} = T_n, U_{-1} = 0, U_{-n} = -U_{n-2}", () => {
  for (let n = 1; n <= 5; n++) sameExact(["ChebyshevT", -n, "x"], ["ChebyshevT", n, "x"]);
  exactJson(["ChebyshevU", -1, "x"], 0);
  sameExact(["ChebyshevU", -2, "x"], ["Negate", ["ChebyshevU", 0, "x"]]);
  sameExact(["ChebyshevU", -5, "x"], ["Negate", ["ChebyshevU", 3, "x"]]);
});

test("stays symbolic for a symbolic order", () => {
  exactJson(["ChebyshevT", "n", "x"], ["ChebyshevT", "n", "x"]);
  exactJson(["ChebyshevU", "n", "x"], ["ChebyshevU", "n", "x"]);
});

// --- LegendrePolynomial exact integer path ------------------------------------------

test("low-degree LegendrePolynomial, exactly, at a symbol", () => {
  sameExact(["LegendrePolynomial", 0, "x"], 1);
  sameExact(["LegendrePolynomial", 1, "x"], "x");
  // P2 = (3x² − 1)/2, P3 = (5x³ − 3x)/2 — compared against compute-engine's own
  // canonical form (Rational coefficients distributed over Add) rather than a
  // Divide/Subtract tree, which evaluate() does not canonicalize to the same shape.
  exactJson(
    ["LegendrePolynomial", 2, "x"],
    ["Add", ["Multiply", ["Rational", 3, 2], ["Power", "x", 2]], ["Rational", -1, 2]],
  );
  exactJson(
    ["LegendrePolynomial", 3, "x"],
    ["Add", ["Multiply", ["Rational", 5, 2], ["Power", "x", 3]], ["Multiply", ["Rational", -3, 2], "x"]],
  );
});

test("P_n(1) = 1 and P_n(-1) = (-1)^n exactly, for every n", () => {
  for (let n = 0; n <= 6; n++) {
    exactJson(["LegendrePolynomial", n, 1], 1);
    exactJson(["LegendrePolynomial", n, -1], n % 2 === 0 ? 1 : -1);
  }
});

test("negative order folds per Wolfram: P_{-n} = P_{n-1}", () => {
  for (let n = 1; n <= 5; n++) {
    sameExact(["LegendrePolynomial", -n, "x"], ["LegendrePolynomial", n - 1, "x"]);
  }
});

test("stays symbolic for a symbolic order", () => {
  exactJson(["LegendrePolynomial", "n", "x"], ["LegendrePolynomial", "n", "x"]);
});

// --- RisingFactorial -----------------------------------------------------------------

test("RisingFactorial is Pochhammer, exactly — the native head, never redeclared", () => {
  exactJson(["RisingFactorial", 3, 5], ce.box(["Pochhammer", 3, 5]).evaluate().json);
  sameExact(["RisingFactorial", "n", 4], ["Pochhammer", "n", 4]);
  exactJson(["RisingFactorial", 0, 5], 0);
});

test("RisingFactorial covers the complex-order case native Pochhammer leaves NaN", () => {
  const native = ce.box(["Pochhammer", ["Complex", 2, 5], ["Complex", 3, 2]]).N();
  expect(Number.isNaN(native.re)).toBe(true); // the gap this head fills
  const r = ce.box(["RisingFactorial", ["Complex", 2, 5], ["Complex", 3, 2]]).N();
  expect(r.re).toBeCloseTo(20.647407894772435, 9);
  expect(r.im).toBeCloseTo(24.047356710232805, 9);
});

test("a pole of Γ(a) at a nonpositive integer a gives 0 for a complex order (Wolfram, mpmath agree)", () => {
  const r = ce.box(["RisingFactorial", -2, ["Complex", 1, 1]]).N();
  expect(r.json).toEqual(0);
});
