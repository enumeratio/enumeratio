import { expect, test } from "vite-plus/test";
import {
  booleanLattice,
  chain,
  convolve,
  divisorLattice,
  incidenceDimension,
  intervals,
  matrixOf,
  maskMembers,
  moebius,
  moebiusInvert,
  type Poset,
  sumDown,
  zeta,
} from "../src/poset.ts";

/** The classical number-theoretic Möbius function, computed independently. */
const classicalMoebius = (n: number): number => {
  let rest = n;
  let primes = 0;
  for (let p = 2; p * p <= rest; p++) {
    if (rest % p !== 0) continue;
    rest /= p;
    primes++;
    if (rest % p === 0) return 0; // a squared factor
  }
  if (rest > 1) primes++;
  return primes % 2 === 0 ? 1 : -1;
};

const identityMatrix = (n: number) =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

test("μ is the inverse of ζ — the defining property", () => {
  // ζ ∗ μ = δ and μ ∗ ζ = δ, checked as matrices. Everything else follows from this.
  const posets = [chain(5)!, booleanLattice(3)!, divisorLattice(36)!, divisorLattice(30)!];
  for (const poset of posets) {
    const z = matrixOf(poset, zeta);
    const m = matrixOf(poset, moebius);
    const identity = identityMatrix(poset.elements.length);
    expect(convolve(z, m), `ζ∗μ on ${poset.name}`).toEqual(identity);
    expect(convolve(m, z), `μ∗ζ on ${poset.name}`).toEqual(identity);
  }
});

test("Boolean lattice: μ([S,T]) = (−1)^{|T\\S|} — inclusion–exclusion", () => {
  for (const n of [1, 2, 3, 4]) {
    const poset = booleanLattice(n)!;
    for (const { from, to } of intervals(poset)) {
      const added =
        maskMembers(Number(poset.elements[to]!)).length -
        maskMembers(Number(poset.elements[from]!)).length;
      expect(moebius(poset, from, to), `${poset.elements[from]}→${poset.elements[to]}`).toBe(
        added % 2 === 0 ? 1 : -1,
      );
    }
  }
});

test("divisor lattice: μ([a,b]) is the classical μ(b/a)", () => {
  // The number-theoretic Möbius function IS the poset one, on this poset. That is the
  // statement the incidence algebra exists to make.
  for (const n of [12, 30, 36, 60, 210]) {
    const poset = divisorLattice(n)!;
    for (const { from, to } of intervals(poset)) {
      const a = Number(poset.elements[from]!);
      const b = Number(poset.elements[to]!);
      expect(moebius(poset, from, to), `μ([${a},${b}]) in D(${n})`).toBe(classicalMoebius(b / a));
    }
  }
});

test("a chain: μ is 1, −1 on covers, and 0 beyond", () => {
  const poset = chain(6)!;
  for (const { from, to } of intervals(poset)) {
    const gap = to - from;
    expect(moebius(poset, from, to)).toBe(gap === 0 ? 1 : gap === 1 ? -1 : 0);
  }
});

test("Möbius inversion recovers the original function", () => {
  const posets: Poset[] = [chain(5)!, booleanLattice(3)!, divisorLattice(60)!];
  for (const poset of posets) {
    // A few arbitrary functions, summed down and inverted back.
    const samples = [
      poset.elements.map((_, i) => i + 1),
      poset.elements.map((_, i) => (i % 3) - 1),
      poset.elements.map(() => 7),
    ];
    for (const f of samples) {
      expect(moebiusInvert(poset, sumDown(poset, f)), poset.name).toEqual(f);
      // And the other way round: inverting first then summing also returns f.
      expect(sumDown(poset, moebiusInvert(poset, f)), poset.name).toEqual(f);
    }
  }
});

test("the dimension is the number of intervals", () => {
  // A chain on n has C(n+1,2) intervals; the Boolean lattice on n has 3^n (choose, for
  // each element, whether it is in S, in T\\S, or in neither).
  for (const n of [1, 2, 3, 4, 5]) {
    expect(incidenceDimension(chain(n)!), `chain ${n}`).toBe((n * (n + 1)) / 2);
    expect(incidenceDimension(booleanLattice(n)!), `boolean ${n}`).toBe(3 ** n);
  }
  // The divisor lattice of a prime power p^k is a chain.
  expect(incidenceDimension(divisorLattice(32)!)).toBe(incidenceDimension(chain(6)!));
});

test("the poset is stored in a linear extension", () => {
  // Which is what makes ζ upper-triangular with ones on the diagonal, hence invertible
  // over the integers — the reason μ has integer values at all.
  for (const poset of [chain(5)!, booleanLattice(3)!, divisorLattice(60)!]) {
    for (const { from, to } of intervals(poset)) {
      expect(from, `${poset.name} linear extension`).toBeLessThanOrEqual(to);
    }
  }
});

test("degenerate and out-of-range posets yield nothing", () => {
  expect(chain(0)).toBeUndefined();
  expect(booleanLattice(-1)).toBeUndefined();
  expect(divisorLattice(0)).toBeUndefined();
});
