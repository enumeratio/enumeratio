// Finite posets, and the incidence algebra over one.
//
// The incidence algebra of a poset P has a basis indexed by its INTERVALS — the pairs
// x ≤ y — and the product is convolution: e_{[x,y]} · e_{[u,z]} is e_{[x,z]} when y = u
// and zero otherwise. So it is a category algebra: composable intervals compose, and
// non-composable ones annihilate. That makes it the first family here whose product is
// frequently ZERO, which is a different kind of structure again.
//
// The reason to build it is the Möbius function. The zeta function ζ(x,y) = 1 for every
// interval is an element of this algebra, and it is INVERTIBLE; its inverse is μ. That
// one fact is Möbius inversion, and specialising the poset recovers the classical
// statements: the divisor lattice gives number theory's μ, the Boolean lattice gives
// inclusion–exclusion.

/** A finite poset: its elements, and the order relation on their indices. */
export interface Poset {
  readonly name: string;
  /** Element labels, in a linear extension (so i ≤ j implies index(i) ≤ index(j)). */
  readonly elements: readonly string[];
  /** Whether element i is ≤ element j. */
  leq(i: number, j: number): boolean;
}

/**
 * Build a poset from a label list and a relation, stored in a LINEAR EXTENSION.
 *
 * The extension cannot come from `Array.sort` with "is a ≤ b" as the comparator: on a
 * genuine partial order that comparator is not transitive (it says nothing about
 * incomparable pairs), and sort then produces an order that violates the relation —
 * `DivisorLattice(60)` came out with 12 before 3. Instead sort by how many elements lie
 * below each one. That IS a linear extension, because x < y forces {z : z ≤ x} to be a
 * proper subset of {z : z ≤ y}, so the count strictly increases along the order.
 */
function build(
  name: string,
  labels: readonly string[],
  leq: (a: string, b: string) => boolean,
): Poset {
  const below = new Map(labels.map((a) => [a, labels.filter((b) => leq(b, a)).length]));
  const sorted = [...labels].sort(
    (a, b) => (below.get(a) ?? 0) - (below.get(b) ?? 0) || a.localeCompare(b),
  );
  return {
    name,
    elements: sorted,
    leq: (i, j) => leq(sorted[i]!, sorted[j]!),
  };
}

/** The chain 1 < 2 < … < n. */
export const chain = (n: number): Poset | undefined =>
  n < 1
    ? undefined
    : build(
        `Chain(${n})`,
        Array.from({ length: n }, (_, i) => String(i + 1)),
        (a, b) => Number(a) <= Number(b),
      );

/** The Boolean lattice: subsets of {1…n} ordered by inclusion. Labels are bitmasks. */
export const booleanLattice = (n: number): Poset | undefined => {
  if (n < 0 || n > 12) return undefined;
  const labels = Array.from({ length: 2 ** n }, (_, mask) => String(mask));
  return build(`BooleanLattice(${n})`, labels, (a, b) => (Number(a) & Number(b)) === Number(a));
};

/** The divisors of n, ordered by divisibility. */
export const divisorLattice = (n: number): Poset | undefined => {
  if (!Number.isSafeInteger(n) || n < 1 || n > 100_000) return undefined;
  const divisors: string[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) divisors.push(String(d));
  return build(`DivisorLattice(${n})`, divisors, (a, b) => Number(b) % Number(a) === 0);
};

/** Subsets of {1…n} as a readable label, for the Boolean lattice's bitmask labels. */
export const maskMembers = (mask: number): number[] =>
  Array.from({ length: 32 }, (_, b) => b + 1).filter((b) => (mask >> (b - 1)) & 1);

// ── the incidence algebra ───────────────────────────────────────────────────────

/** Every interval [x, y] of the poset, as index pairs — the basis. */
export function intervals(poset: Poset): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  for (let i = 0; i < poset.elements.length; i++) {
    for (let j = 0; j < poset.elements.length; j++) {
      if (poset.leq(i, j)) found.push({ from: i, to: j });
    }
  }
  return found;
}

/** The dimension of the incidence algebra: one basis element per interval. */
export const incidenceDimension = (poset: Poset): number => intervals(poset).length;

/**
 * The Möbius function μ(x, y), by its defining recursion:
 *     μ(x, x) = 1,      μ(x, y) = −Σ_{x ≤ z < y} μ(x, z).
 * Which is exactly the statement that μ is the inverse of ζ in the incidence algebra.
 * Returns 0 outside the order relation, as the convention requires.
 */
export function moebius(poset: Poset, from: number, to: number): number {
  if (!poset.leq(from, to)) return 0;
  if (from === to) return 1;
  let total = 0;
  for (let z = 0; z < poset.elements.length; z++) {
    if (z !== to && poset.leq(from, z) && poset.leq(z, to)) total += moebius(poset, from, z);
  }
  return total === 0 ? 0 : -total; // never hand back a negative zero
}

/** ζ(x, y) — one on every interval, zero elsewhere. */
export const zeta = (poset: Poset, from: number, to: number): number =>
  poset.leq(from, to) ? 1 : 0;

/** A function on intervals as a square matrix over the elements. */
export function matrixOf(
  poset: Poset,
  f: (poset: Poset, i: number, j: number) => number,
): number[][] {
  const n = poset.elements.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(poset, i, j)));
}

/** Convolution of two functions on intervals: (f∗g)(x,z) = Σ_{x≤y≤z} f(x,y)·g(y,z). */
export function convolve(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, k) => {
      let total = 0;
      for (let j = 0; j < n; j++) total += (a[i]![j] ?? 0) * (b[j]![k] ?? 0);
      return total;
    }),
  );
}

/**
 * Möbius inversion: given g(y) = Σ_{x ≤ y} f(x), recover f(y) = Σ_{x ≤ y} μ(x,y)·g(x).
 * The theorem, stated as code — and the reason the whole algebra is worth having.
 */
export function moebiusInvert(poset: Poset, g: readonly number[]): number[] {
  return poset.elements.map((_, y) => {
    let total = 0;
    for (let x = 0; x < poset.elements.length; x++) {
      if (poset.leq(x, y)) total += moebius(poset, x, y) * (g[x] ?? 0);
    }
    return total;
  });
}

/** Summing down: g(y) = Σ_{x ≤ y} f(x). The map Möbius inversion undoes. */
export function sumDown(poset: Poset, f: readonly number[]): number[] {
  return poset.elements.map((_, y) => {
    let total = 0;
    for (let x = 0; x < poset.elements.length; x++) {
      if (poset.leq(x, y)) total += f[x] ?? 0;
    }
    return total;
  });
}
