import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareResidues } from "@enumeratio/residues/src";
import { expect, test } from "vite-plus/test";
import { declareAdeles, visualPosition } from "../src/declare.ts";
import { fibonacciPair } from "../src/profinite.ts";

// What the Sage oracle (golden.test.ts) does not reach: our own additions and edges.
// Head-level checks (expect(run(expr)).toEqual(value)) now live as `role: test` examples
// on the heads they exercise (ProfiniteNumber, Adele, Idele, ProfinitePlot). What stays
// here tests below the head level: internal functions, property sweeps, and one
// declare-order artifact of this file's own engine setup.

const ce = new ComputeEngine();
declareResidues(ce);
declareNumerals(ce);
declareNumberTheory(ce);
declareAdeles(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

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
  const odd = [1n, 3n, 5n].map((a) => visualPosition(a, 3)).sort((x, y) => x - y);
  expect(odd).toEqual([3, 4, 5]);
  expect([0n, 1n, 2n, 3n, 4n, 5n].map((a) => visualPosition(a, 3)).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5]);
});

test("a real (non-integer) Fibonacci index is refused when adeles loads after number-theory", () => {
  // This is a declare-order artifact of THIS file, not documented behavior: widenSignature
  // narrows Fibonacci's native gate to `mayBeInteger`, and whichever of adeles'/number-theory's
  // calls runs last wins (see packages/reference/scripts/engines.ts's comment on
  // `LIBRARY_DECLARATIONS`, which declares number-theory last precisely so its own wider
  // signature — real index via Binet, two-argument polynomial — wins instead). Here
  // number-theory is declared BEFORE adeles, so adeles' narrower signature wins and a real
  // index like 2.5 is refused. Kept as a unit test rather than a reference example because
  // the reference engine's canonical declare order gives a different (evaluated) answer.
  expect(run(["Fibonacci", 2.5])).toEqual(["Fibonacci", 2.5]);
});
