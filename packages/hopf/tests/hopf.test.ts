import { expect, test } from "vite-plus/test";
import {
  antipode,
  basis,
  type Composition,
  compositions,
  counit,
  degree,
  type Element,
  fromKey,
  type HopfAlgebra,
  nsym,
  plus,
  qsym,
  quasiShuffle,
  splitTensorKey,
  type Tensor,
  unit,
} from "../src/hopf.ts";

const show = (e: Element) => [...e].sort(([a], [b]) => a.localeCompare(b));
const showTensor = (t: Tensor) => [...t].sort(([a], [b]) => a.localeCompare(b));
const algebras: HopfAlgebra[] = [nsym, qsym];
const smallBasis = (n: number) => compositions(n).map(basis);

test("compositions of n number 2^(n−1)", () => {
  // The graded dimension of both algebras — and the count enumeratio already knows.
  for (const n of [1, 2, 3, 4, 5, 6]) {
    expect(compositions(n).length, `n = ${n}`).toBe(2 ** (n - 1));
  }
  expect(compositions(0)).toEqual([[]]);
});

test("both products are associative", () => {
  for (const algebra of algebras) {
    const sample = [...smallBasis(1), ...smallBasis(2), ...smallBasis(3)];
    for (const a of sample) {
      for (const b of sample) {
        for (const c of sample.slice(0, 4)) {
          expect(
            show(algebra.product(algebra.product(a, b), c)),
            `${algebra.name} associativity`,
          ).toEqual(show(algebra.product(a, algebra.product(b, c))));
        }
      }
    }
  }
});

test("the unit is a unit, and the counit picks out the constant term", () => {
  for (const algebra of algebras) {
    for (const a of [...smallBasis(2), ...smallBasis(3)]) {
      expect(show(algebra.product(unit, a)), algebra.name).toEqual(show(a));
      expect(show(algebra.product(a, unit)), algebra.name).toEqual(show(a));
    }
  }
  expect(counit(unit)).toBe(1);
  expect(counit(basis([2]))).toBe(0);
});

test("both coproducts are coassociative", () => {
  // (Δ⊗id)Δ = (id⊗Δ)Δ, compared as maps into the triple tensor product.
  for (const algebra of algebras) {
    for (const a of [...smallBasis(1), ...smallBasis(2), ...smallBasis(3), ...smallBasis(4)]) {
      const left = new Map<string, number>();
      const right = new Map<string, number>();
      for (const [key, c] of algebra.coproduct(a)) {
        const [x, y] = splitTensorKey(key);
        // Split the LEFT half again.
        for (const [innerKey, ic] of algebra.coproduct(basis(x))) {
          const [p, q] = splitTensorKey(innerKey);
          const triple = `${p.join(",")}|${q.join(",")}|${y.join(",")}`;
          left.set(triple, (left.get(triple) ?? 0) + c * ic);
        }
        // …and the RIGHT half.
        for (const [innerKey, ic] of algebra.coproduct(basis(y))) {
          const [p, q] = splitTensorKey(innerKey);
          const triple = `${x.join(",")}|${p.join(",")}|${q.join(",")}`;
          right.set(triple, (right.get(triple) ?? 0) + c * ic);
        }
      }
      // Map equality is entry-wise and order-blind, which is the comparison wanted.
      expect(left, `${algebra.name} coassociativity`).toEqual(right);
    }
  }
});

test("the bialgebra axiom: Δ(xy) = Δ(x)·Δ(y)", () => {
  // THE compatibility. The product and the coproduct are written independently, so this
  // identity is a real check that they describe one structure rather than two.
  for (const algebra of algebras) {
    const sample = [...smallBasis(1), ...smallBasis(2), ...smallBasis(3)];
    for (const a of sample) {
      for (const b of sample) {
        expect(
          showTensor(algebra.coproduct(algebra.product(a, b))),
          `${algebra.name} compatibility`,
        ).toEqual(showTensor(algebra.tensorProduct(algebra.coproduct(a), algebra.coproduct(b))));
      }
    }
  }
});

test("the antipode satisfies the Hopf axiom m(S⊗id)Δ = ηε", () => {
  // The defining property, checked by running it rather than by trusting the recursion.
  for (const algebra of algebras) {
    for (const a of [...smallBasis(1), ...smallBasis(2), ...smallBasis(3), ...smallBasis(4)]) {
      const parts: Element[] = [];
      for (const [key, c] of algebra.coproduct(a)) {
        const [left, right] = splitTensorKey(key);
        const term = algebra.product(antipode(algebra, basis(left)), basis(right));
        parts.push(new Map([...term].map(([k, v]) => [k, v * c])));
      }
      const result = plus(...parts);
      // ηε(x) is 0 for anything of positive degree.
      expect(
        [...result].filter(([, v]) => v !== 0),
        `${algebra.name} antipode`,
      ).toEqual([]);
    }
  }
});

test("everything is graded: degree adds under the product and splits under Δ", () => {
  for (const algebra of algebras) {
    for (const a of smallBasis(3)) {
      for (const b of smallBasis(2)) {
        for (const [key] of algebra.product(a, b)) {
          expect(degree(fromKey(key)), `${algebra.name} product grading`).toBe(5);
        }
      }
      for (const [key] of algebra.coproduct(a)) {
        const [left, right] = splitTensorKey(key);
        expect(degree(left) + degree(right), `${algebra.name} coproduct grading`).toBe(3);
      }
    }
  }
});

test("NSym's product really is concatenation", () => {
  expect(show(nsym.product(basis([2]), basis([1, 3])))).toEqual([["2,1,3", 1]]);
  expect(show(nsym.product(basis([1]), basis([1])))).toEqual([["1,1", 1]]);
  // Δ(H_2) = 1⊗H_2 + H_1⊗H_1 + H_2⊗1.
  expect(showTensor(nsym.coproduct(basis([2])))).toEqual([
    ["|2", 1],
    ["1|1", 1],
    ["2|", 1],
  ]);
});

test("QSym's product really is the quasi-shuffle", () => {
  // M_1 · M_1 = 2·M_{1,1} + M_2 — the overlap term is what distinguishes a quasi-shuffle
  // from an ordinary shuffle.
  expect(show(qsym.product(basis([1]), basis([1])))).toEqual([
    ["1,1", 2],
    ["2", 1],
  ]);
  expect(quasiShuffle([1], [2]).map((c: Composition) => c.join(","))).toEqual(["1,2", "2,1", "3"]);
  // Δ(M_{1,2}) is deconcatenation: three terms.
  expect(showTensor(qsym.coproduct(basis([1, 2])))).toEqual([
    ["|1,2", 1],
    ["1,2|", 1],
    ["1|2", 1],
  ]);
});

test("QSym is commutative and NSym is not", () => {
  // Quasi-symmetric functions commute; non-commutative symmetric functions are named
  // for the fact that they do not.
  for (const a of smallBasis(2)) {
    for (const b of smallBasis(3)) {
      expect(show(qsym.product(a, b))).toEqual(show(qsym.product(b, a)));
    }
  }
  expect(show(nsym.product(basis([1]), basis([2])))).not.toEqual(
    show(nsym.product(basis([2]), basis([1]))),
  );
});

test("the antipode on low degrees", () => {
  // S(H_1) = −H_1 in NSym, and S is an anti-homomorphism, so S(H_1H_1) = S(H_1)S(H_1).
  expect(show(antipode(nsym, basis([1])))).toEqual([["1", -1]]);
  expect(show(antipode(qsym, basis([1])))).toEqual([["1", -1]]);
  // Applying S twice returns the identity on a commutative Hopf algebra (QSym).
  for (const a of [...smallBasis(1), ...smallBasis(2), ...smallBasis(3)]) {
    expect(show(antipode(qsym, antipode(qsym, a))), "S² = id on QSym").toEqual(show(a));
  }
});
