import type { DiagramClass } from "./diagram.ts";

// Closed forms for the dimensions. Each is derived from the combinatorics, not from
// the enumeration — which is what makes them usable as an oracle: the tests generate
// every diagram of a class by brute force and check the count against the formula
// here, so a bug in either side shows up as a disagreement.
//
// This is also the part that ties the family back to the catalogue: these ARE the
// counting sequences enumeratio is built out of.

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

const binomial = (n: number, k: number): number => {
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
};

/** Bell number B(n) — the set partitions of an n-set, via the Bell triangle. */
export function bell(n: number): number {
  let row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [row[row.length - 1]!];
    for (const value of row) next.push(next[next.length - 1]! + value);
    row = next;
  }
  return row[0]!;
}

/** Catalan number C(n) = binomial(2n, n) / (n+1). */
export const catalan = (n: number): number => binomial(2 * n, n) / (n + 1);

/** Motzkin number M(n), by the standard recurrence. */
export function motzkin(n: number): number {
  const m = [1, 1];
  for (let i = 2; i <= n; i++) {
    m[i] = ((2 * i + 1) * m[i - 1]! + (3 * i - 3) * m[i - 2]!) / (i + 2);
  }
  return m[n] ?? 1;
}

/** Odd double factorial (2n−1)!! — the perfect matchings of 2n points. */
export function doubleFactorialOdd(n: number): number {
  let result = 1;
  for (let k = 1; k <= n; k++) result *= 2 * k - 1;
  return result;
}

/** The rook number Σ_k C(n,k)² k! — the partial permutations of an n-set. */
export function rookCount(n: number): number {
  let total = 0;
  for (let k = 0; k <= n; k++) total += binomial(n, k) ** 2 * factorial(k);
  return total;
}

/** The dimension of a diagram algebra, in closed form. */
export function dimensionOf(cls: DiagramClass, n: number): number {
  switch (cls) {
    case "partition":
      return bell(2 * n);
    case "planar-partition":
      return catalan(2 * n);
    case "brauer":
      return doubleFactorialOdd(n);
    case "temperley-lieb":
      return catalan(n);
    case "motzkin":
      return motzkin(2 * n);
    case "rook":
      return rookCount(n);
    case "symmetric":
      return factorial(n);
  }
}

/** How each dimension reads as a sequence, for the docs and the reference. */
export const DIMENSION_FORMULA: Record<DiagramClass, string> = {
  partition: "B(2n), the Bell numbers",
  "planar-partition": "C(2n), the Catalan numbers",
  brauer: "(2n−1)!!, the perfect matchings",
  "temperley-lieb": "C(n), the Catalan numbers",
  motzkin: "M(2n), the Motzkin numbers",
  rook: "Σ C(n,k)²k!, the partial permutations",
  symmetric: "n!",
};
