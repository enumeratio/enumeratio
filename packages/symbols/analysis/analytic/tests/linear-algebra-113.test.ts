import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// MatrixRank of a square matrix of pairwise-distinct symbols: full rank, n. See
// linear-algebra-113.ts for the proof (the determinant, as a polynomial in independent
// indeterminates, can never be identically zero). Checked against a Wolfram kernel.

const ce = new ComputeEngine();
declareAnalytic(ce);

test("MatrixRank: a 2x2 of distinct symbols is full rank, 2 (#113)", () => {
  const r = ce.box(["MatrixRank", ["List", ["List", "a", "b"], ["List", "c", "d"]]]).evaluate();
  expect(r.toString()).toBe("2");
});

test("MatrixRank: a 3x3 of distinct symbols is full rank, 3 (#113)", () => {
  // Avoid `e` and `i` -- compute-engine reads those as ExponentialE / ImaginaryUnit,
  // not plain symbols, so they're not "distinct symbols" in the sense this rule needs.
  const r = ce
    .box([
      "MatrixRank",
      ["List", ["List", "p", "q", "r"], ["List", "s", "t", "u"], ["List", "v", "w", "x"]],
    ])
    .evaluate();
  expect(r.toString()).toBe("3");
});

test("MatrixRank: a repeated symbol does NOT qualify -- stays unevaluated (#113)", () => {
  const r = ce.box(["MatrixRank", ["List", ["List", "x", 1], ["List", 1, "x"]]]).evaluate();
  expect(r.operator).toBe("MatrixRank");
});

test("MatrixRank: a non-square matrix of distinct symbols does NOT qualify (#113)", () => {
  const r = ce
    .box(["MatrixRank", ["List", ["List", "a", "b", "c"], ["List", "d", "e", "f"]]])
    .evaluate();
  expect(r.operator).toBe("MatrixRank");
});

test("MatrixRank: repeating a symbol across rows does NOT qualify (#113)", () => {
  const r = ce.box(["MatrixRank", ["List", ["List", "a", "b"], ["List", "a", "b"]]]).evaluate();
  // Native compute-engine still answers this one directly (rank 1, equal rows) --
  // the distinct-symbol rule just doesn't need to fire.
  expect(r.toString()).toBe("1");
});
