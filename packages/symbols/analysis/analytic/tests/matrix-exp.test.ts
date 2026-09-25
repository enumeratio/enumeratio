import { readFileSync } from "node:fs";
import type { BoxedExpression } from "@cortex-js/compute-engine";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// MatrixExp — the matrix exponential. Numeric evaluation (the scaling-and-squaring path,
// exercised here by the non-diagonal, non-2×2, non-nilpotent cases) is held to the oracle
// values in matrix-exp.golden.json, which scripts/collect-matrix-exp-goldens.ts gathers
// from mpmath (`expm`) and a Wolfram kernel (`MatrixExp`) — neither is needed to run this
// file. The exact closed forms (diagonal / 2×2 / nilpotent) are checked directly below,
// against the same golden matrices, so both the exact and numeric paths are pinned.

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  matrix: number[][];
  label: string;
  tol: number;
  mpmath?: number[][];
  wolfram?: number[][];
}

const goldens: GoldenCase[] = JSON.parse(readFileSync(new URL("./matrix-exp.golden.json", import.meta.url), "utf8"));

const matrixExpr = (m: number[][]) => ["List", ...m.map((row) => ["List", ...row])] as const;

/** Read a `List` of `List`s of numbers back out as plain JS numbers. */
const toRows = (expr: BoxedExpression): number[][] => operandsOf(expr).map((row) => operandsOf(row).map((e) => e.re));

const relErr = (ours: number[][], ref: number[][]): number => {
  let max = 0;
  let scale = 1;
  for (let i = 0; i < ours.length; i++) {
    for (let j = 0; j < ours[i].length; j++) {
      max = Math.max(max, Math.abs(ours[i][j] - ref[i][j]));
      scale = Math.max(scale, Math.abs(ref[i][j]));
    }
  }
  return max / scale;
};

test("MatrixExp: every golden case matches the oracles under N()", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce.box(["MatrixExp", matrixExpr(g.matrix)] as never).N();
    const ours = toRows(r);
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

test("MatrixExp: exact evaluate() (no N()) also matches the oracles, numerically", () => {
  const off: string[] = [];
  for (const g of goldens) {
    const r = ce
      .box(["MatrixExp", matrixExpr(g.matrix)] as never)
      .evaluate()
      .N();
    const ours = toRows(r);
    const ref = g.mpmath ?? g.wolfram!;
    const err = relErr(ours, ref);
    if (!(err <= g.tol)) off.push(`${g.label}: relerr ${err.toExponential(2)}`);
  }
  expect(off).toEqual([]);
});

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

test("MatrixExp(A, v) agrees with MatrixExp(A) times v, on a golden case, under N() (#113)", () => {
  const g = goldens[0];
  const v = [1, 2, 3].slice(0, g.matrix.length);
  const whole = ce.box(["MatrixExp", matrixExpr(g.matrix)] as never).N();
  const rows = toRows(whole);
  const expected = rows.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
  const r = ce.box(["MatrixExp", matrixExpr(g.matrix), ["List", ...v]] as never).N();
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
