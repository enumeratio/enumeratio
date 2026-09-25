import { hermiteDecomposition } from "@enumeratio/number-theory";
import * as P from "./profinite.ts";
import type { Profinite } from "./profinite.ts";
import * as Q from "./rational.ts";
import type { Q as Rational } from "./rational.ts";

// Strong approximation for GL_n: every M ∈ GL_n(Q̂) factors as M = B·A with B ∈ GL_n(Ẑ) and
// A ∈ GL_n⁺(Q) — Hertogh's Algorithm 8.4 (`factor_GLQhat`). A is found from the lattice
// Ẑⁿ·M ∩ Qⁿ: scale the columns integral by D, stack det(MD)·I under the value matrix of MD
// (which puts the lattice back inside ℤⁿ without changing it), take the Hermite normal form,
// and undo D. B is then M·A⁻¹.

type Matrix<T> = T[][];

export function determinant(m: Matrix<Rational>): Rational {
  const n = m.length;
  const a = m.map((row) => [...row]);
  let det: Rational = Q.ONE;
  for (let c = 0; c < n; c++) {
    const r = a.findIndex((row, i) => i >= c && !Q.isZero(row[c]!));
    if (r < 0) return Q.ZERO;
    if (r !== c) {
      [a[r], a[c]] = [a[c]!, a[r]!];
      det = Q.neg(det);
    }
    const pivot = a[c]![c]!;
    det = Q.mul(det, pivot);
    for (let i = c + 1; i < n; i++) {
      const f = Q.div(a[i]![c]!, pivot);
      if (Q.isZero(f)) continue;
      a[i] = a[i]!.map((x, j) => Q.sub(x, Q.mul(f, a[c]![j]!)));
    }
  }
  return det;
}

export function inverse(m: Matrix<Rational>): Matrix<Rational> | undefined {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j): Rational => (i === j ? Q.ONE : Q.ZERO))]);
  for (let c = 0; c < n; c++) {
    const r = a.findIndex((row, i) => i >= c && !Q.isZero(row[c]!));
    if (r < 0) return undefined;
    [a[r], a[c]] = [a[c]!, a[r]!];
    const pivot = a[c]![c]!;
    a[c] = a[c]!.map((x) => Q.div(x, pivot));
    for (let i = 0; i < n; i++) {
      if (i === c || Q.isZero(a[i]![c]!)) continue;
      const f = a[i]![c]!;
      a[i] = a[i]!.map((x, j) => Q.sub(x, Q.mul(f, a[c]![j]!)));
    }
  }
  return a.map((row) => row.slice(n));
}

/** M·R for a profinite M and a rational R. */
export function multiplyRational(m: Matrix<Profinite>, r: Matrix<Rational>): Matrix<Profinite> {
  return m.map((row) =>
    r[0]!.map((_, j) => row.reduce((acc, x, k) => P.add(acc, P.multiply(x, P.exact(r[k]![j]!))), P.exact(Q.ZERO))),
  );
}

/**
 * {B, A} with M = B·A, B ∈ GL_n(Ẑ), A ∈ GL_n⁺(Q) upper triangular, or `undefined` when M is
 * singular or known too coarsely: Hertogh's precision test asks det(M)·det(D) to divide
 * the modulus of M·D. `det` is det M, by default that of the value matrix.
 */
export function profiniteDecomposition(
  m: Matrix<Profinite>,
  det?: Rational,
): { b: Matrix<Profinite>; a: Matrix<Rational> } | undefined {
  const n = m.length;
  if (n === 0 || m.some((row) => row.length !== n)) return undefined;
  const delta = det ?? determinant(m.map((row) => row.map((x) => x.value)));
  if (Q.isZero(delta)) return undefined;

  // Step 1: D scales each column to integral entries.
  const d = m[0]!.map((_, j) => m.reduce((acc, row) => Q.lcm(acc, P.denominator(row[j]!)), 1n));
  const md = m.map((row) => row.map((x, j) => P.multiply(x, P.exact([d[j]!, 1n]))));
  const detD = d.reduce((acc, x) => acc * x, 1n);
  const detMD = Q.mul(delta, [detD, 1n]);

  // Precision: every entry of MD must be known modulo det(MD).
  const modulus = md.flat().reduce<Rational>((acc, x) => Q.gcdQ(acc, x.modulus), Q.ZERO);
  if (!Q.isZero(modulus) && !Q.isInteger(Q.div(modulus, detMD))) return undefined;
  if (!Q.isInteger(detMD)) return undefined;

  // Steps 2–3: HNF of the value matrix of MD stacked on det(MD)·I.
  const values = md.map((row) => row.map((x) => x.value));
  if (values.flat().some((x) => !Q.isInteger(x))) return undefined;
  const stacked = [
    ...values.map((row) => row.map((x) => x[0])),
    ...Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? detMD[0] : 0n))),
  ];
  const a0 = hermiteDecomposition(stacked).h.slice(0, n);

  // Hertogh's step 4 flips a row to make det A₀ positive; with positive HNF pivots on a
  // triangular A₀ it always is. Step 5: A = A₀·D⁻¹, B = M·A⁻¹.
  const a = a0.map((row) => row.map((x, j) => Q.q(x, d[j]!)));
  const aInverse = inverse(a);
  if (aInverse === undefined) return undefined;
  return { b: multiplyRational(m, aInverse), a };
}
