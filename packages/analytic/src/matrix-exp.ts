import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { add, cx, type Cx, mul, scale } from "./complex.ts";
import { type EvalOptions, wantsNumber } from "./box.ts";

// MatrixExp(m) — the matrix exponential e^M = Σ_{k≥0} M^k / k!, for a square matrix m.
// Wolfram names this MatrixExp too (its Exp maps element-wise, same as ours — see the
// Exp entry's divergence note).
//
// Exact where the structure gives us one:
//  - diagonal m, any size: elementwise Exp down the diagonal.
//  - 2×2 m: the Cayley–Hamilton closed form
//      e^M = e^{tr/2} [ cosh(Δ/2) I + (sinh(Δ/2)/Δ)(2M − tr·I) ],  Δ² = tr² − 4·det,
//    taking the Δ → 0 limit (sinh(Δ/2)/Δ → 1/2) at a repeated eigenvalue — which also
//    covers every 2×2 nilpotent m (Δ = 0, tr = 2λ).
//  - nilpotent m of any size, when every entry is exact: the series I + N + N²/2! + … +
//    N^(k−1)/(k−1)! terminates once Nᵏ = 0, which happens by k = n at the latest.
// Otherwise numeric only, and only under N(): scaling-and-squaring — halve the matrix by
// a power of two until its (∞-)norm is small, Taylor-sum the scaled matrix (which converges
// fast there), then square the result back up.

export type BMatrix = readonly (readonly BoxedExpression[])[];

/** Read `m` as a rectangular matrix of (already-evaluated) entries. Shared with
 * matrix-function.ts, which needs the same reading of a boxed matrix. */
export function rowsOf(expr: BoxedExpression): BMatrix {
  return operandsOf(expr).map((row) => operandsOf(row));
}

/** compute-engine's own convention for a non-square operand — see native Inverse/Eigenvalues/…. */
export function squareMatrixError(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  return ce.error("expected-square-matrix", expr.toString());
}

const isZero = (e: BoxedExpression): boolean => e.isSame(0);

/** `.isExact` lives on compute-engine's boxed-number interface, not the general one. */
const mayBeExact = (e: BoxedExpression): boolean =>
  (e as Partial<{ isExact: boolean }>).isExact !== false;

export function isDiagonal(rows: BMatrix, n: number): boolean {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && !isZero(rows[i][j])) return false;
    }
  }
  return true;
}

export function listOf(
  ce: ComputeEngine,
  rows: readonly (readonly BoxedExpression[])[],
): BoxedExpression {
  return ce.function(
    "List",
    rows.map((row) => ce.function("List", [...row])),
  );
}

/** diag(m) exact, elementwise: exp(a_ii) on the diagonal, 0 off it. */
function expDiagonal(ce: ComputeEngine, rows: BMatrix, n: number): BoxedExpression {
  const result: BoxedExpression[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = i === j ? ce.function("Exp", [rows[i][j]]).evaluate() : ce.Zero;
    }
  }
  return listOf(ce, result);
}

/**
 * The 2×2 closed form (see the file header). Handles every 2×2 matrix exactly — diagonal,
 * nilpotent, and the general case — via one formula with a removable singularity at Δ = 0.
 */
function expTwoByTwo(ce: ComputeEngine, rows: BMatrix): BoxedExpression {
  const [[a, b], [c, d]] = rows;
  const trace = ce.function("Add", [a, d]).evaluate();
  const det = ce
    .function("Subtract", [ce.function("Multiply", [a, d]), ce.function("Multiply", [b, c])])
    .evaluate();
  const discSq = ce
    .function("Subtract", [ce.function("Power", [trace, 2]), ce.function("Multiply", [4, det])])
    .evaluate();
  const halfTrace = ce.function("Divide", [trace, 2]).evaluate();
  const expHalfTrace = ce.function("Exp", [halfTrace]).evaluate();
  const degenerate = discSq.isSame(0);
  const cosh = degenerate
    ? ce.One
    : ce.function("Cosh", [ce.function("Divide", [ce.function("Sqrt", [discSq]), 2])]).evaluate();
  const coeff = degenerate
    ? ce.box(["Rational", 1, 2])
    : ce
        .function("Divide", [
          ce.function("Sinh", [ce.function("Divide", [ce.function("Sqrt", [discSq]), 2])]),
          ce.function("Sqrt", [discSq]),
        ])
        .evaluate();

  const entry = (i: number, j: number): BoxedExpression => {
    const aij = rows[i][j];
    const iij = i === j ? 1 : 0;
    // (2·a_ij − tr·I_ij), the "2M − tr·I" entry.
    const twoMMinusTraceI = ce
      .function("Subtract", [
        ce.function("Multiply", [2, aij]),
        ce.function("Multiply", [iij, trace]),
      ])
      .evaluate();
    const inner = ce
      .function("Add", [
        ce.function("Multiply", [iij, cosh]),
        ce.function("Multiply", [coeff, twoMMinusTraceI]),
      ])
      .evaluate();
    return ce.function("Multiply", [expHalfTrace, inner]).evaluate();
  };

  return listOf(ce, [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ]);
}

function identityExact(ce: ComputeEngine, n: number): BoxedExpression[][] {
  const rows: BoxedExpression[][] = [];
  for (let i = 0; i < n; i++) {
    rows[i] = [];
    for (let j = 0; j < n; j++) rows[i][j] = i === j ? ce.One : ce.Zero;
  }
  return rows;
}

function mulExact(ce: ComputeEngine, a: BMatrix, b: BMatrix, n: number): BoxedExpression[][] {
  const result: BoxedExpression[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      const terms: BoxedExpression[] = [];
      for (let k = 0; k < n; k++) terms.push(ce.function("Multiply", [a[i][k], b[k][j]]));
      result[i][j] = ce.function("Add", terms).evaluate();
    }
  }
  return result;
}

function isZeroMatrix(m: BMatrix, n: number): boolean {
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!isZero(m[i][j])) return false;
  return true;
}

/**
 * exp(N) for a nilpotent N, exact: the truncated series I + N + N²/2! + … + N^(k−1)/(k−1)!,
 * where Nᵏ = 0 terminates it (k ≤ n for an n×n matrix). Returns undefined if N turns out not
 * to be nilpotent after all (Nⁿ ≠ 0), so the caller can fall back to the numeric path.
 */
function expNilpotentExact(
  ce: ComputeEngine,
  rows: BMatrix,
  n: number,
): BoxedExpression | undefined {
  let power: BoxedExpression[][] = identityExact(ce, n);
  let sum: BoxedExpression[][] = identityExact(ce, n);
  let factorial = 1;
  for (let k = 1; k <= n; k++) {
    power = mulExact(ce, power, rows, n);
    if (isZeroMatrix(power, n)) return listOf(ce, sum);
    factorial *= k;
    const scaled: BoxedExpression[][] = power.map((row) =>
      row.map((e) => ce.function("Divide", [e, factorial]).evaluate()),
    );
    sum = sum.map((row, i) => row.map((e, j) => ce.function("Add", [e, scaled[i][j]]).evaluate()));
  }
  return undefined; // Nⁿ ≠ 0: not nilpotent
}

/** Read a matrix entry as a double-precision complex number, via N(); undefined if not finite. */
function entryToCx(e: BoxedExpression): Cx | undefined {
  const v = e.N();
  return Number.isFinite(v.re) && Number.isFinite(v.im) ? cx(v.re, v.im) : undefined;
}

type NMatrix = Cx[][];

function addN(a: NMatrix, b: NMatrix, n: number): NMatrix {
  const r: NMatrix = [];
  for (let i = 0; i < n; i++) {
    r[i] = [];
    for (let j = 0; j < n; j++) r[i][j] = add(a[i][j], b[i][j]);
  }
  return r;
}

function mulN(a: NMatrix, b: NMatrix, n: number): NMatrix {
  const r: NMatrix = [];
  for (let i = 0; i < n; i++) {
    r[i] = [];
    for (let j = 0; j < n; j++) {
      let s = cx(0, 0);
      for (let k = 0; k < n; k++) s = add(s, mul(a[i][k], b[k][j]));
      r[i][j] = s;
    }
  }
  return r;
}

function scaleN(a: NMatrix, k: number, n: number): NMatrix {
  return a.map((row) => row.map((x) => scale(x, k)));
}

function identityN(n: number): NMatrix {
  const r: NMatrix = [];
  for (let i = 0; i < n; i++) {
    r[i] = [];
    for (let j = 0; j < n; j++) r[i][j] = cx(i === j ? 1 : 0, 0);
  }
  return r;
}

/** ∞-norm (max absolute row sum), the natural scale for the Taylor tail's convergence. */
function infNorm(m: NMatrix, n: number): number {
  let max = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) rowSum += Math.hypot(m[i][j].re, m[i][j].im);
    max = Math.max(max, rowSum);
  }
  return max;
}

const TAYLOR_TERMS = 40;
const SCALE_TARGET = 0.5; // keeps the Taylor tail well inside double precision by ~15 terms

/**
 * Numeric exp(A), double precision: scaling-and-squaring. Scale A by 2^(−s) until its norm
 * is at most SCALE_TARGET, Taylor-sum the scaled matrix, then square s times to undo the scale
 * (exp(A) = exp(A/2^s)^(2^s)).
 */
function expNumeric(a: NMatrix, n: number): NMatrix {
  const norm = infNorm(a, n);
  const s = norm > SCALE_TARGET ? Math.max(0, Math.ceil(Math.log2(norm / SCALE_TARGET))) : 0;
  const scaleFactor = 2 ** s;
  const scaled = s === 0 ? a : scaleN(a, 1 / scaleFactor, n);

  let term = identityN(n);
  let result = identityN(n);
  for (let k = 1; k <= TAYLOR_TERMS; k++) {
    term = mulN(term, scaled, n);
    term = scaleN(term, 1 / k, n);
    result = addN(result, term, n);
    if (infNorm(term, n) < 1e-18) break;
  }
  for (let i = 0; i < s; i++) result = mulN(result, result, n);
  return result;
}

function nMatrixToExpr(ce: ComputeEngine, m: NMatrix, n: number): BoxedExpression {
  const rows: BoxedExpression[][] = [];
  for (let i = 0; i < n; i++) {
    rows[i] = [];
    for (let j = 0; j < n; j++) {
      const { re, im } = m[i][j];
      rows[i][j] =
        Math.abs(im) < 1e-13 * (1 + Math.abs(re)) ? ce.number(re) : ce.number(ce.complex(re, im));
    }
  }
  return listOf(ce, rows);
}

export function evaluateMatrixExp(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const m = ops[0];
  if (m === undefined) return undefined;
  const rows = rowsOf(m);
  const n = rows.length;
  if (n === 0 || rows.some((row) => row.length !== n)) return squareMatrixError(ce, m);

  // An exact result (diagonal / 2×2 / nilpotent) still needs N() applied when the caller
  // asked for a number — its pieces (Cosh, Sqrt, …) don't collapse to floats on their own.
  const numeric = wantsNumber(ops, options);
  const finish = (e: BoxedExpression): BoxedExpression => (numeric ? e.N() : e);

  if (isDiagonal(rows, n)) return finish(expDiagonal(ce, rows, n));
  if (n === 2) return finish(expTwoByTwo(ce, rows));
  if (rows.every((row) => row.every(mayBeExact))) {
    const exact = expNilpotentExact(ce, rows, n);
    if (exact !== undefined) return finish(exact);
  }

  if (!numeric) return undefined; // stay symbolic until N()
  const entries = rows.map((row) => row.map(entryToCx));
  if (entries.some((row) => row.some((e) => e === undefined))) return undefined;
  return nMatrixToExpr(ce, expNumeric(entries as NMatrix, n), n);
}

export function declareMatrixExp(ce: ComputeEngine): void {
  ce.declare("MatrixExp", {
    signature: "(matrix) -> matrix",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateMatrixExp(ce, ops, options),
  });
}
