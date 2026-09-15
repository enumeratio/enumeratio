import { expect, test } from "vite-plus/test";
import {
  coarsenings,
  coarsens,
  completeToRibbon,
  concatenate,
  conjugateComposition,
  descentSet,
  fromDescentSet,
  fundamentalToMonomial,
  monomialToFundamental,
  nearConcatenate,
  pair,
  refinements,
  ribbonAntipode,
  ribbonProduct,
  ribbonToComplete,
} from "../src/bases.ts";
import {
  antipode,
  basis,
  type Composition,
  compositionKey,
  compositions,
  type Element,
  nsym,
  nsymProduct,
} from "../src/hopf.ts";

const show = (e: Element) => [...e].filter(([, c]) => c !== 0).sort(([a], [b]) => (a < b ? -1 : 1));
const same = (a: Element, b: Element) =>
  expect(JSON.stringify(show(a))).toBe(JSON.stringify(show(b)));

test("a composition is a subset, and the correspondence round-trips", () => {
  for (let n = 0; n <= 7; n++) {
    for (const a of compositions(n)) {
      const set = descentSet(a);
      expect(fromDescentSet(set, n), compositionKey(a)).toEqual(a);
      expect(set.length, compositionKey(a)).toBe(Math.max(0, a.length - 1));
    }
    // …and the subsets of {1, …, n−1} are exactly the compositions of n.
    expect(compositions(n).length).toBe(n === 0 ? 1 : 2 ** (n - 1));
  }
  expect(fromDescentSet([3], 3)).toBeUndefined(); // out of range
});

test("coarsenings and refinements are the two directions of the same lattice", () => {
  for (let n = 1; n <= 6; n++) {
    for (const a of compositions(n)) {
      // 2^(number of internal points) of each, on the two sides.
      expect(coarsenings(a).length, compositionKey(a)).toBe(2 ** Math.max(0, a.length - 1));
      expect(refinements(a).length, compositionKey(a)).toBe(2 ** (n - a.length));
      for (const b of coarsenings(a)) expect(coarsens(b, a), compositionKey(a)).toBe(true);
      // β refines α exactly when α coarsens β.
      for (const b of refinements(a)) expect(coarsens(a, b), compositionKey(a)).toBe(true);
    }
  }
});

test("the two change-of-basis maps invert each other, both sides", () => {
  // Möbius inversion over the Boolean lattice, in both algebras.
  for (let n = 0; n <= 7; n++) {
    for (const a of compositions(n)) {
      same(ribbonToComplete(completeToRibbon(basis(a))), basis(a));
      same(completeToRibbon(ribbonToComplete(basis(a))), basis(a));
      same(fundamentalToMonomial(monomialToFundamental(basis(a))), basis(a));
      same(monomialToFundamental(fundamentalToMonomial(basis(a))), basis(a));
    }
  }
});

test("the ribbon and fundamental bases are dual, which nothing above forced", () => {
  // ⟨H_α, M_β⟩ = δ is the pairing; if R and F are dual then ⟨R_α, F_β⟩ = δ too. The two
  // transition matrices are written down separately and in opposite directions, so this
  // holds only if both are right.
  for (let n = 0; n <= 6; n++) {
    for (const a of compositions(n)) {
      for (const b of compositions(n)) {
        const value = pair(ribbonToComplete(basis(a)), fundamentalToMonomial(basis(b)));
        expect(value, `⟨R_${compositionKey(a)}, F_${compositionKey(b)}⟩`).toBe(
          compositionKey(a) === compositionKey(b) ? 1 : 0,
        );
      }
    }
  }
});

test("the ribbon product has two terms, and agrees with the product in H", () => {
  // R_α · R_β = R_{α·β} + R_{α▷β}. The right-hand side is a closed form; the left is
  // computed by going to H, multiplying there, and coming back.
  for (let m = 1; m <= 4; m++) {
    for (let n = 1; n <= 4; n++) {
      for (const a of compositions(m)) {
        for (const b of compositions(n)) {
          const viaComplete = completeToRibbon(
            nsymProduct(ribbonToComplete(basis(a)), ribbonToComplete(basis(b))),
          );
          same(viaComplete, ribbonProduct(a, b));
        }
      }
    }
  }
  expect(concatenate([2, 1], [3])).toEqual([2, 1, 3]);
  expect(nearConcatenate([2, 1], [3])).toEqual([2, 4]);
  // The two terms coincide for nothing: concatenation always has one more part.
  expect(ribbonProduct([1], [1]).size).toBe(2);
});

test("the conjugate composition is an involution, and transposes the lattice", () => {
  for (let n = 1; n <= 7; n++) {
    for (const a of compositions(n)) {
      const conjugate = conjugateComposition(a);
      expect(
        conjugate.reduce((x, y) => x + y, 0),
        compositionKey(a),
      ).toBe(n);
      expect(conjugateComposition(conjugate), compositionKey(a)).toEqual(a);
      // The number of parts complements: ℓ(α) + ℓ(α*) = n + 1.
      expect(a.length + conjugate.length, compositionKey(a)).toBe(n + 1);
    }
  }
  expect(conjugateComposition([3])).toEqual([1, 1, 1]);
  expect(conjugateComposition([1, 1, 1])).toEqual([3]);
  // At n = 3 both two-part compositions are self-conjugate. Which involution this is gets
  // settled by the antipode test below, not by taste: only one of the two candidate maps
  // makes S(R_α) a single term.
  expect(conjugateComposition([2, 1])).toEqual([2, 1]);
  expect(conjugateComposition([1, 2])).toEqual([1, 2]);
});

test("the antipode on a ribbon is a single signed term", () => {
  // S(R_α) = (−1)^{|α|} R_{α*}. The left side runs the recursive antipode in the H basis
  // and converts; the right side is one basis element.
  for (let n = 1; n <= 6; n++) {
    for (const a of compositions(n)) {
      const viaComplete = completeToRibbon(antipode(nsym, ribbonToComplete(basis(a))));
      same(viaComplete, ribbonAntipode(a));
    }
  }
});

test("the small fundamental expansions are the textbook ones", () => {
  const asComposition = (key: string): Composition =>
    key === "" ? [] : key.split(",").map(Number);
  // F_(1,1) = M_(1,1) and F_(2) = M_(2) + M_(1,1): the fundamental basis refines.
  expect(show(fundamentalToMonomial(basis([1, 1]))).map(([k]) => asComposition(k))).toEqual([
    [1, 1],
  ]);
  expect(show(fundamentalToMonomial(basis([2]))).map(([k]) => asComposition(k))).toEqual([
    [1, 1],
    [2],
  ]);
  // The other way round in NSym: R_(2) = H_(2) is the "row" ribbon, and the signed one is
  // R_(1,1) = H_(1,1) − H_(2), because (1,1) is the finer composition and has more
  // coarsenings to subtract.
  same(ribbonToComplete(basis([2])), basis([2]));
  expect(show(ribbonToComplete(basis([1, 1])))).toEqual([
    ["1,1", 1],
    ["2", -1],
  ]);
});
