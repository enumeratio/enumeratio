import { expect, test } from "vite-plus/test";
import {
  alexanderPolynomial,
  braid,
  braidPower,
  burau,
  components,
  compose,
  crossings,
  freeReduce,
  inversions,
  invert,
  isKnot,
  isPositive,
  permutationOf,
  positiveBraidGenus,
  positivePermutationBraid,
  torusAlexander,
  torusBraid,
  writhe,
} from "../src/braid.ts";
import { equals, format, identityMatrix, multiplyMatrices, normalise } from "../src/laurent.ts";

const sigma = (strands: number, ...word: number[]) => braid(strands, word)!;

test("the two Artin relations hold in the Burau representation", () => {
  // If the generator matrices were wrong, these would almost certainly break — they are
  // the defining relations of the group, checked in a faithful-enough linear model.
  for (const n of [4, 5, 6]) {
    for (let i = 1; i + 1 < n; i++) {
      const left = burau(sigma(n, i, i + 1, i))!;
      const right = burau(sigma(n, i + 1, i, i + 1))!;
      left.forEach((row, r) =>
        row.forEach((entry, c) => {
          expect(equals(entry, right[r]![c]!), `braid relation n=${n} i=${i}`).toBe(true);
        }),
      );
    }
    for (let i = 1; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        const left = burau(sigma(n, i, j))!;
        const right = burau(sigma(n, j, i))!;
        left.forEach((row, r) =>
          row.forEach((entry, c) => {
            expect(equals(entry, right[r]![c]!), `far commutation ${i},${j}`).toBe(true);
          }),
        );
      }
    }
  }
});

test("a generator times its inverse is the identity matrix", () => {
  for (const n of [2, 3, 5]) {
    for (let i = 1; i < n; i++) {
      const product = burau(sigma(n, i, -i))!;
      const target = identityMatrix(n - 1);
      product.forEach((row, r) =>
        row.forEach((entry, c) => {
          expect(equals(entry, target[r]![c]!), `n=${n} i=${i}`).toBe(true);
        }),
      );
    }
  }
});

test("Burau is a homomorphism: the matrix of a product is the product of matrices", () => {
  const a = sigma(4, 1, 2, -3, 2);
  const b = sigma(4, 3, -1, 1, 2);
  const both = burau(compose(a, b)!)!;
  const stepwise = multiplyMatrices(burau(a)!, burau(b)!)!;
  both.forEach((row, r) =>
    row.forEach((entry, c) => {
      expect(equals(entry, stepwise[r]![c]!)).toBe(true);
    }),
  );
});

test("the permutation, writhe and closure count", () => {
  expect(permutationOf(sigma(3, 1))).toEqual([1, 0, 2]);
  expect(permutationOf(sigma(3, 1, 2))).toEqual([1, 2, 0]);
  expect(writhe(sigma(4, 1, 2, -3, -3))).toBe(0);
  expect(writhe(sigma(2, 1, 1, 1))).toBe(3);
  // The trefoil braid closes to one component; the Hopf-link braid to two.
  expect(components(sigma(2, 1, 1, 1))).toBe(1);
  expect(components(sigma(2, 1, 1))).toBe(2);
  expect(isKnot(torusBraid(2, 3)!)).toBe(true);
  expect(isKnot(torusBraid(2, 4)!)).toBe(false); // T(2,4) is a two-component link
  // A braid and its inverse close up the same way.
  expect(components(invert(sigma(4, 1, 2, 3)))).toBe(components(sigma(4, 1, 2, 3)));
});

test("free reduction cancels inverse pairs and nothing else", () => {
  expect(freeReduce(sigma(3, 1, -1, 2)).word).toEqual([2]);
  expect(freeReduce(sigma(3, 1, 2, -2, -1)).word).toEqual([]);
  // σ₁σ₂σ₁ and σ₂σ₁σ₂ are equal in the group but NOT freely — reduction is not a
  // solution to the word problem, and the test says so.
  expect(freeReduce(sigma(3, 1, 2, 1)).word).toEqual([1, 2, 1]);
});

test("positive permutation braids realise their permutation, minimally", () => {
  const permutations = (n: number): number[][] => {
    if (n === 0) return [[]];
    return permutations(n - 1).flatMap((rest) =>
      Array.from({ length: n }, (_, i) => [...rest.slice(0, i), n - 1, ...rest.slice(i)]),
    );
  };
  for (const n of [2, 3, 4, 5]) {
    for (const permutation of permutations(n)) {
      const b = positivePermutationBraid(permutation)!;
      expect(permutationOf(b), `${permutation}`).toEqual(permutation);
      expect(isPositive(b), `${permutation}`).toBe(true);
      // No pair of strands crosses twice: the length is exactly the inversion count.
      expect(crossings(b), `${permutation}`).toBe(inversions(permutation));
    }
  }
  expect(positivePermutationBraid([0, 0, 1])).toBeUndefined(); // not a permutation
});

test("the Alexander polynomial of the small knots", () => {
  // The trefoil is the closure of σ₁³ in B₂, and its polynomial is 1 − t + t².
  expect(format(alexanderPolynomial(sigma(2, 1, 1, 1))!)).toBe("1 - t + t^2");
  // The figure-eight knot is the closure of (σ₁σ₂⁻¹)² in B₃: 1 − 3t + t².
  expect(format(alexanderPolynomial(braidPower(sigma(3, 1, -2), 2)!)!)).toBe("1 - 3t + t^2");
  // The unknot, as the closure of a single strand's worth of braid.
  expect(format(alexanderPolynomial(sigma(2, 1))!)).toBe("1");
  // The (2,5) torus knot — the Solomon's seal.
  expect(format(alexanderPolynomial(sigma(2, 1, 1, 1, 1, 1))!)).toBe("1 - t + t^2 - t^3 + t^4");
});

test("Burau agrees with the closed-form torus-knot polynomial", () => {
  // The oracle: a formula with no braid in it. If the Burau generators or the Alexander
  // formula were wrong, these would diverge immediately.
  const coprime = (a: number, b: number): boolean => {
    let [x, y] = [a, b];
    while (y !== 0) [x, y] = [y, x % y];
    return x === 1;
  };
  for (let p = 2; p <= 6; p++) {
    for (let q = 2; q <= 9; q++) {
      if (!coprime(p, q)) continue;
      const fromBraid = alexanderPolynomial(torusBraid(p, q)!);
      const closedForm = torusAlexander(p, q);
      expect(fromBraid, `T(${p},${q})`).toBeDefined();
      expect(format(fromBraid!), `T(${p},${q})`).toBe(format(normalise(closedForm!)));
    }
  }
});

test("the genus of a positive braid closure is Bennequin's count", () => {
  // g = (c − s + 1)/2, and for a torus knot that is (p−1)(q−1)/2.
  const coprime = (a: number, b: number): boolean => {
    let [x, y] = [a, b];
    while (y !== 0) [x, y] = [y, x % y];
    return x === 1;
  };
  for (let p = 2; p <= 6; p++) {
    for (let q = 2; q <= 9; q++) {
      if (!coprime(p, q)) continue;
      expect(positiveBraidGenus(torusBraid(p, q)!), `T(${p},${q})`).toBe(((p - 1) * (q - 1)) / 2);
    }
  }
  // The degree of the Alexander polynomial is 2g for these, which is the other half of
  // the same fact — fibred knots have deg Δ = 2·genus.
  for (const [p, q] of [
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
  ] as const) {
    const polynomial = alexanderPolynomial(torusBraid(p, q)!)!;
    expect(polynomial.coefficients.length - 1, `T(${p},${q})`).toBe((p - 1) * (q - 1));
  }
  expect(positiveBraidGenus(sigma(3, 1, -2))).toBeUndefined(); // not positive
});

test("degenerate input yields nothing", () => {
  expect(braid(3, [3])).toBeUndefined(); // σ₃ needs four strands
  expect(braid(0, [])).toBeUndefined();
  expect(braid(3, [0])).toBeUndefined();
  expect(torusBraid(1, 3)).toBeUndefined();
  expect(torusAlexander(2, 4)).toBeUndefined(); // not coprime: not a knot
  expect(compose(sigma(3, 1), sigma(4, 1))).toBeUndefined();
});
