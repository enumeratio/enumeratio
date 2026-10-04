import { box, type Json } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { declareNumberTheory } from "@enumeratio/number-theory";
import { declareNumerals } from "@enumeratio/numerals";
import { declareResidues } from "@enumeratio/residues";
import { expect, test } from "vite-plus/test";
import { declareAdeles, visualPosition } from "../src/declare.ts";
import { fibonacciPair } from "../src/profinite.ts";

// What the Sage oracle (golden.test.ts) does not reach: our own additions and edges.
// Head-level checks (expect(run(expr)).toEqual(value)) now live as `role: test` examples
// on the heads they exercise (ProfiniteNumber, Adele, Idele, ProfinitePlot). What stays
// here tests below the head level: internal functions, property sweeps, and one
// declare-order artifact of this file's own engine setup.

const ce = createEngine(declareResidues, declareNumerals, declareNumberTheory, declareAdeles);
const run = (expr: unknown): unknown => box(ce, expr as Json).evaluate().json;

test("fibonacciPair satisfies Lenstra's Lucas identity mod π(11)", () => {
  // Every n ≡ 3 mod 10 gives Lₙ ≡ 4 mod 11 (see ProfiniteNumber's "Lenstra's profinite
  // Lucas numbers" example, which pins one instance of this at the head level).
  for (const n of [3n, 13n, 23n, 103n]) {
    const [f0, f1] = fibonacciPair(n);
    expect((2n * f1 - f0) % 11n).toBe(4n);
  }
});

test("visualPosition lays residues out by factorial digits", () => {
  // φ(1 + 2Ẑ) = [1/2, 1]: at level 3, the odd residues fill the right half.
  const odd = [1n, 3n, 5n].map((a) => visualPosition(a, 3)).toSorted((x, y) => x - y);
  expect(odd).toEqual([3, 4, 5]);
  expect([0n, 1n, 2n, 3n, 4n, 5n].map((a) => visualPosition(a, 3)).toSorted((x, y) => x - y)).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
});

test("a real Fibonacci index evaluates whichever of adeles and number-theory declares last", () => {
  // Both extend Fibonacci as rows in its table (defineOverload), so declare order no longer
  // decides which package's form survives: this file declares number-theory first, and
  // number-theory's real index (via Binet) still answers beside adeles' profinite one.
  const value = run(["Fibonacci", 2.5]);
  expect(typeof value === "number" || (value as { num?: string }).num !== undefined).toBe(true);
});
