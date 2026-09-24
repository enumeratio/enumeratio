import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { expect, test } from "vite-plus/test";
import { declareAdeles, visualPosition } from "../src/declare.ts";
import { fibonacciPair } from "../src/profinite.ts";

// What the Sage oracle (golden.test.ts) does not reach: our own additions and edges.

const ce = new ComputeEngine();
declareNumerals(ce);
declareNumberTheory(ce);
declareAdeles(ce);
const run = (expr: unknown): unknown =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;
const profinite = (x: unknown, m: unknown): unknown => ["ProfiniteNumber", x, m];

test("ProfiniteNumber normalises and collapses when exact", () => {
  expect(run(profinite(26, 20))).toEqual(profinite(6, 20));
  expect(run(profinite(-1, 12))).toEqual(profinite(11, 12));
  expect(run(profinite(5, -12))).toEqual(profinite(5, 12));
  expect(run(profinite(["Rational", 7, 2], ["Rational", 3, 2]))).toEqual(
    profinite(["Rational", 1, 2], ["Rational", 3, 2]),
  );
  expect(run(profinite(["Rational", 1, 3], 0))).toEqual(["Rational", 1, 3]);
  expect(run(["Subtract", profinite(7, 30), 2])).toEqual(profinite(5, 30));
  expect(run(["Power", profinite(3, 12), 2])).toEqual(profinite(9, 36));
});

test("division only by an exact divisor", () => {
  expect(run(["Divide", profinite(4, 12), 2])).toEqual(profinite(2, 6));
  expect(run(["Divide", 1, profinite(5, 12)])).toEqual(["Divide", 1, profinite(5, 12)]);
});

test("Fibonacci and LucasL on Ẑ", () => {
  // Lenstra's example: F(3 mod 10) = 2 mod 11 — π(11) = 10.
  expect(run(["Fibonacci", profinite(3, 10)])).toEqual(profinite(2, 11));
  expect(run(["LucasL", profinite(3, 10)])).toEqual(profinite(4, 11));
  // Every n ≡ 3 mod 10 gives Lₙ ≡ 4 mod 11.
  for (const n of [3n, 13n, 23n, 103n]) {
    const [f0, f1] = fibonacciPair(n);
    expect((2n * f1 - f0) % 11n).toBe(4n);
  }
  expect(run(["Fibonacci", 10])).toBe(55);
  expect(run(["Fibonacci", profinite(["Rational", 1, 2], 3)])).toEqual([
    "Fibonacci",
    profinite(["Rational", 1, 2], 3),
  ]);
});

test("AdicNumeral(p, z) projects to Q_p", () => {
  expect(run(["AdicNumeral", 2, profinite(100, 24)])).toEqual(["AdicNumeral", 2, 4, 3]);
  expect(run(["AdicNumeral", 3, profinite(100, 24)])).toEqual(["AdicNumeral", 3, 1, 1]);
  // 5 does not divide the modulus: nothing is known at 5.
  expect(run(["AdicNumeral", 5, profinite(100, 24)])).toEqual(["AdicNumeral", 5, profinite(4, 24)]);
  // And back: gluing the projections at every prime of the modulus is the identity.
  expect(
    run([
      "ProfiniteNumber",
      ["List", ["AdicNumeral", 2, profinite(100, 24)], ["AdicNumeral", 3, profinite(100, 24)]],
    ]),
  ).toEqual(profinite(4, 24));
});

test("adèles: componentwise, rationals on the diagonal", () => {
  expect(run(["Adele", 5])).toEqual(["Adele", 5, 5]);
  expect(run(["Multiply", ["Adele", 2, profinite(1, 6)], 3])).toEqual([
    "Adele",
    6,
    profinite(3, 18),
  ]);
  expect(run(["Add", ["Adele", 5], ["Adele", "Pi", profinite(1, 6)]])).toEqual([
    "Adele",
    ["Add", 5, "Pi"],
    profinite(0, 6),
  ]);
  expect(run(["Equal", ["Adele", 1, profinite(2, 6)], ["Adele", 1, profinite(5, 9)]])).toBe("True");
  expect(run(["Equal", ["Adele", 2, profinite(2, 6)], ["Adele", 1, profinite(5, 9)]])).toBe(
    "False",
  );
  // An adèle and a bare profinite number do not combine.
  expect(run(["Add", ["Adele", 1, profinite(2, 6)], profinite(1, 6)])).toEqual([
    "Add",
    profinite(1, 6),
    ["Adele", 1, profinite(2, 6)],
  ]);
});

test("idèles: principal, local, a listed component carries its valuation into the scale", () => {
  expect(run(["Idele", 7])).toEqual(["Idele", 7, 7]);
  expect(run(["Multiply", ["Idele", 7], ["Idele", ["Rational", 1, 7]]])).toEqual(["Idele", 1, 1]);
  expect(run(["Idele", 1, 1, ["List", ["AdicNumeral", 5, ["Rational", 15, 7], 4]]])).toEqual([
    "Idele",
    1,
    5,
    ["List", ["AdicNumeral", 5, 54, 3]],
  ]);
  // At 2 a unit known mod 2 says nothing.
  expect(run(["Idele", 1, 1, ["List", ["AdicNumeral", 2, 3, 1]]])).toEqual([
    "Idele",
    1,
    1,
    ["List"],
  ]);
  expect(run(["Idele", 0, 1])).toEqual(["Idele", 0, 1]);
});

test("visualPosition lays residues out by factorial digits", () => {
  // φ(1 + 2Ẑ) = [1/2, 1]: at level 3, the odd residues fill the right half.
  const odd = [1n, 3n, 5n].map((a) => visualPosition(a, 3)).sort((x, y) => x - y);
  expect(odd).toEqual([3, 4, 5]);
  expect([0n, 1n, 2n, 3n, 4n, 5n].map((a) => visualPosition(a, 3)).sort((x, y) => x - y)).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
});

test("ProfinitePlot draws the identity as a diagonal", () => {
  const plot = run(["ProfinitePlot", "x", "x", 3]) as [string, unknown[]];
  expect(plot[0]).toBe("ArrayPlot");
  const rows = (plot[1] as unknown[][]).slice(1).map((row) => row.slice(1));
  expect(rows).toEqual(
    Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i + j === 5 ? 1 : 0))),
  );
  expect(run(["ProfinitePlot", "x", "x", 9])).toEqual(["ProfinitePlot", "x", "x", 9]);
});
