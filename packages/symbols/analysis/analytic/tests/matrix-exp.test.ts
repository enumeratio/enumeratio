import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// MatrixExp — the matrix exponential. Numeric evaluation (the scaling-and-squaring path)
// and the exact closed forms (diagonal / 2×2 / nilpotent) below. Oracle coverage (mpmath's
// `expm` and a Wolfram kernel, across the same matrix shapes) now lives as `known` values
// on the reference examples (packages/reference/tests/known.test.ts), not here.

const ce = new ComputeEngine();
declareAnalytic(ce);

const matrixExpr = (m: number[][]) => ["List", ...m.map((row) => ["List", ...row])] as const;

test("MatrixExp: diagonal matrices stay exact, elementwise", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 3],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[e,0,0],[0,e^2,0],[0,0,e^3]]");
});

test("MatrixExp: [[0,1],[1,0]] is exactly [[cosh 1, sinh 1], [sinh 1, cosh 1]]", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [0, 1],
        [1, 0],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[cosh(1),sinh(1)],[sinh(1),cosh(1)]]");
});

test("MatrixExp: [[0,1],[0,0]] (nilpotent) is exactly [[1,1],[0,1]]", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [0, 1],
        [0, 0],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[1,1],[0,1]]");
});

test("MatrixExp: a nilpotent 3x3 stays exact via the truncated series", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[1,1,1/2],[0,1,1],[0,0,1]]");
});

test("MatrixExp: a Jordan block (degenerate 2x2) is e^λ (I + N)", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [2, 1],
        [0, 2],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[e^2,e^2],[0,e^2]]");
});

test("MatrixExp: rejects a non-square matrix, like native Inverse/Eigenvalues/…", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ] as never)
    .evaluate();
  expect(r.operator).toBe("Error");
});

test("MatrixExp: a skew-symmetric 2x2 generator reduces to a rotation, in Cos/Sin (#113)", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [0, 1],
        [-1, 0],
      ]),
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[[cos(1),sin(1)],[-sin(1),cos(1)]]");
});

test("MatrixExp: Euler's identity for matrices -- rotation by pi is -I (#113)", () => {
  const r = ce.box(["MatrixExp", ["List", ["List", 0, ["Negate", "Pi"]], ["List", "Pi", 0]]] as never).evaluate();
  expect(r.toString()).toBe("[[-1,0],[0,-1]]");
});

test("MatrixExp(A, v): e^A v, without a separate MatrixExp(A) call (#113)", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [0, 1],
        [0, 0],
      ]),
      ["List", 1, 1],
    ] as never)
    .evaluate();
  expect(r.toString()).toBe("[2,1]");
});

test("MatrixExp(A, v) agrees with MatrixExp(A) times v, on the symmetric 2x2 case, under N() (#113)", () => {
  const matrix = [
    [0, 1],
    [1, 0],
  ];
  const v = [1, 2];
  const whole = ce.box(["MatrixExp", matrixExpr(matrix)] as never).N();
  const rows = operandsOf(whole).map((row) => operandsOf(row).map((e) => e.re));
  const expected = rows.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
  const r = ce.box(["MatrixExp", matrixExpr(matrix), ["List", ...v]] as never).N();
  const ours = operandsOf(r).map((e) => e.re);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(ours[i] - expected[i])).toBeLessThan(1e-8);
  }
});

test("MatrixExp: a generic (non-structured) matrix stays symbolic without N()", () => {
  const r = ce
    .box([
      "MatrixExp",
      matrixExpr([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 10],
      ]),
    ] as never)
    .evaluate();
  expect(r.operator).toBe("MatrixExp");
});
