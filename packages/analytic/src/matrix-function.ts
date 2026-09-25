import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { symbolNameOf } from "@enumeratio/boxed";
import { isDiagonal, listOf, rowsOf, squareMatrixError } from "./matrix-exp.ts";
import { type EvalOptions, wantsNumber } from "./box.ts";

// MatrixFunction(f, m) — a scalar function f extended to a square matrix m, via its
// eigendecomposition. Reuses matrix-exp.ts's matrix reader and builder (`rowsOf`, `listOf`,
// `isDiagonal`, `squareMatrixError`), and — when f is literally `Exp` — MatrixExp itself,
// the one case Wolfram calls out by name ("With Exp it is MatrixExp").
//
// Exact where the structure gives us one, same as MatrixExp:
//  - diagonal m, any size (including symbolic entries): elementwise f down the diagonal.
//  - f = Exp: MatrixExp(m), for any m.
//  - 2×2 m otherwise: Lagrange's formula at the two eigenvalues λ₁, λ₂ of
//    tr² − 4·det, i.e. f(M) = f(λ₁)(M − λ₂I)/(λ₁−λ₂) + f(λ₂)(M − λ₁I)/(λ₂−λ₁); at a repeated
//    eigenvalue λ (the discriminant is exactly 0), the Jordan-block limit
//    f(M) = f(λ)·I + f′(λ)·(M − λI), with f′ taken via compute-engine's own `D`.
// Anything larger and non-diagonal has no closed form here — Wolfram's own algorithm
// (Parlett recurrence / Schur form) is a numerical-linear-algebra kernel, out of scope for
// what the backlog's examples need. Those calls stay symbolic (decline, not guess).

/** `f(x)`, for `f` a symbol (`"Sqrt"`, `"f"`, …) or a `Function` literal — both apply the
 * same way once boxed as `[f, x]`. */
function applyF(ce: ComputeEngine, f: BoxedExpression, x: BoxedExpression): BoxedExpression {
  return ce.box([f.json, x.json] as unknown as Parameters<ComputeEngine["box"]>[0]).evaluate();
}

/** f′(x₀), via `D` on `f` applied to a fresh symbol, evaluated there. `applied` is
 * `.evaluate()`d before differentiating — `D` needs the beta-reduced body (`t^2`), not the
 * unevaluated `Apply(f, t)` a `Function` literal boxes as. */
function derivativeOfFAt(ce: ComputeEngine, f: BoxedExpression, x0: number): BoxedExpression {
  const t = "_matrixFunction_t";
  const applied = applyF(ce, f, ce.symbol(t));
  const derivative = ce.function("D", [applied, ce.symbol(t)]).evaluate();
  return derivative.subs({ [t]: x0 }).evaluate();
}

function diagonalApply(
  ce: ComputeEngine,
  f: BoxedExpression,
  rows: readonly (readonly BoxedExpression[])[],
  n: number,
): BoxedExpression {
  const result: BoxedExpression[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) result[i][j] = i === j ? applyF(ce, f, rows[i][j]) : ce.Zero;
  }
  return listOf(ce, result);
}

/** Lagrange's formula for a 2×2 matrix function at its two eigenvalues, taking the Jordan
 * limit when they coincide — see the file header. */
function twoByTwoViaEigen(
  ce: ComputeEngine,
  f: BoxedExpression,
  rows: readonly (readonly BoxedExpression[])[],
): BoxedExpression {
  const [[a, b], [c, d]] = rows;
  const trace = ce.function("Add", [a, d]).evaluate();
  const det = ce
    .function("Subtract", [ce.function("Multiply", [a, d]), ce.function("Multiply", [b, c])])
    .evaluate();
  const discSq = ce
    .function("Subtract", [ce.function("Power", [trace, 2]), ce.function("Multiply", [4, det])])
    .evaluate();

  if (discSq.isSame(0)) {
    const lambda = ce.function("Divide", [trace, 2]).evaluate();
    const fLambda = applyF(ce, f, lambda);
    const fPrime = derivativeOfFAt(ce, f, lambda.N().re);
    const entry = (i: number, j: number): BoxedExpression => {
      const iij = i === j ? 1 : 0;
      const mMinusLambdaI = ce
        .function("Subtract", [rows[i][j], ce.function("Multiply", [iij, lambda])])
        .evaluate();
      return ce
        .function("Add", [
          ce.function("Multiply", [iij, fLambda]),
          ce.function("Multiply", [fPrime, mMinusLambdaI]),
        ])
        .evaluate();
    };
    return listOf(ce, [
      [entry(0, 0), entry(0, 1)],
      [entry(1, 0), entry(1, 1)],
    ]);
  }

  const disc = ce.function("Sqrt", [discSq]).evaluate();
  const lambda1 = ce.function("Divide", [ce.function("Add", [trace, disc]), 2]).evaluate();
  const lambda2 = ce.function("Divide", [ce.function("Subtract", [trace, disc]), 2]).evaluate();
  const f1 = applyF(ce, f, lambda1);
  const f2 = applyF(ce, f, lambda2);
  const entry = (i: number, j: number): BoxedExpression => {
    const iij = i === j ? 1 : 0;
    const term1 = ce
      .function("Divide", [
        ce.function("Multiply", [
          f1,
          ce.function("Subtract", [rows[i][j], ce.function("Multiply", [iij, lambda2])]),
        ]),
        ce.function("Subtract", [lambda1, lambda2]),
      ])
      .evaluate();
    const term2 = ce
      .function("Divide", [
        ce.function("Multiply", [
          f2,
          ce.function("Subtract", [rows[i][j], ce.function("Multiply", [iij, lambda1])]),
        ]),
        ce.function("Subtract", [lambda2, lambda1]),
      ])
      .evaluate();
    return ce.function("Add", [term1, term2]).evaluate();
  };
  return listOf(ce, [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ]);
}

export function evaluateMatrixFunction(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const f = ops[0];
  const m = ops[1];
  if (f === undefined || m === undefined) return undefined;
  const rows = rowsOf(m);
  const n = rows.length;
  if (n === 0 || rows.some((row) => row.length !== n)) return squareMatrixError(ce, m);

  const numeric = wantsNumber(ops, options);
  const finish = (e: BoxedExpression): BoxedExpression => (numeric ? e.N() : e);

  if (isDiagonal(rows, n)) return finish(diagonalApply(ce, f, rows, n));
  if (symbolNameOf(f) === "Exp") return finish(ce.function("MatrixExp", [m]).evaluate());
  if (n === 2) return finish(twoByTwoViaEigen(ce, f, rows));
  return undefined; // no general n×n closed form here — see the file header
}

export function declareMatrixFunction(ce: ComputeEngine): void {
  ce.declare("MatrixFunction", {
    signature: "(function, matrix) -> matrix",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateMatrixFunction(ce, ops, options),
  });
}
