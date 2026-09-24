import { extendedGcd } from "@enumeratio/residues";

// Row-style Hermite normal form over ℤ, Wolfram's convention: u·m = h with u unimodular and
// h upper triangular, each pivot positive and every entry above a pivot in [0, pivot).
// Zero rows sink to the bottom. h is unique; u is unique only when m is square and
// nonsingular.

export type IntegerMatrix = bigint[][];

const floorDiv = (a: bigint, b: bigint): bigint => {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
};

export function hermiteDecomposition(m: readonly (readonly bigint[])[]): {
  u: IntegerMatrix;
  h: IntegerMatrix;
} {
  const rows = m.length;
  const cols = rows === 0 ? 0 : m[0]!.length;
  const h = m.map((row) => [...row]);
  const u = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: rows }, (_, j) => (i === j ? 1n : 0n)),
  );

  // Replace rows i, j by (a·row_i + b·row_j, c·row_i + d·row_j) in both h and u.
  const combine = (i: number, j: number, a: bigint, b: bigint, c: bigint, d: bigint): void => {
    for (const x of [h, u]) {
      const [ri, rj] = [x[i]!, x[j]!];
      for (let k = 0; k < ri.length; k++) {
        const [p, q] = [ri[k]!, rj[k]!];
        ri[k] = a * p + b * q;
        rj[k] = c * p + d * q;
      }
    }
  };
  const addMultiple = (target: number, source: number, factor: bigint): void => {
    if (factor === 0n) return;
    for (const x of [h, u]) {
      const [t, s] = [x[target]!, x[source]!];
      for (let k = 0; k < t.length; k++) t[k] = t[k]! - factor * s[k]!;
    }
  };

  let r = 0;
  for (let col = 0; col < cols && r < rows; col++) {
    // Fold every entry below into the pivot row by gcd steps; a zero pivot takes the other
    // row whole (s = 0, t = ±1), so zero rows sink without an explicit swap.
    for (let i = r + 1; i < rows; i++) {
      const [a, b] = [h[r]![col]!, h[i]![col]!];
      if (b === 0n) continue;
      const [g, s, t] = extendedGcd(a, b);
      // [s t; −b/g a/g] has determinant 1.
      combine(r, i, s, t, -b / g, a / g);
    }
    const pivot = h[r]![col]!;
    if (pivot === 0n) continue;
    if (pivot < 0n) for (const x of [h, u]) x[r] = x[r]!.map((v) => -v);
    const p = h[r]![col]!;
    for (let i = 0; i < r; i++) addMultiple(i, r, floorDiv(h[i]![col]!, p));
    r++;
  }
  return { u, h };
}
