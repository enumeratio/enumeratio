import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHopf } from "../src/declare.ts";

const ce = new ComputeEngine();
declareHopf(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const H = (...parts: number[]): Expr => ["NSymH", ["List", ...parts]];
const M = (...parts: number[]): Expr => ["QSymM", ["List", ...parts]];
const T = (a: Expr, b: Expr): Expr => ["HopfTensor", a, b];
const times = (...parts: Expr[]): Expr => ["NonCommutativeMultiply", ...parts];

test("NSym multiplies by concatenating", () => {
  same(times(H(2), H(1, 3)), H(2, 1, 3));
  same(times(H(1), H(1)), H(1, 1));
  // And it is NOT commutative — that is what the name records.
  expect(ce.box(times(H(1), H(2))).evaluate().json).not.toEqual(
    ce.box(times(H(2), H(1))).evaluate().json,
  );
});

test("QSym multiplies by quasi-shuffling", () => {
  // M_1·M_1 = 2M_{1,1} + M_2. The M_2 term is the OVERLAP, and it is what makes this a
  // quasi-shuffle rather than an ordinary shuffle.
  same(times(M(1), M(1)), ["Add", ["Multiply", 2, M(1, 1)], M(2)]);
  same(times(M(1), M(2)), ["Add", M(1, 2), M(2, 1), M(3)]);
  // QSym IS commutative.
  same(times(M(1), M(2)), times(M(2), M(1)));
});

test("the coproduct returns tensor pairs", () => {
  // Δ(H_2) = 1⊗H_2 + H_2⊗1 + H_1⊗H_1. Terms are compared as a SET, since Add's
  // canonical ordering is the engine's business and not part of the claim.
  const terms = (input: Expr): string[] => {
    const json = ce.box(input).evaluate().json as unknown as unknown[];
    return json
      .slice(1)
      .map((t) => JSON.stringify(t))
      .sort();
  };
  expect(terms(["Coproduct", H(2)])).toEqual(
    terms(["Add", T(H(), H(2)), T(H(1), H(1)), T(H(2), H())]),
  );
  // Δ(M_{1,2}) is deconcatenation: three terms, splitting the composition each way.
  expect(terms(["Coproduct", M(1, 2)])).toEqual(
    terms(["Add", T(M(), M(1, 2)), T(M(1), M(2)), T(M(1, 2), M())]),
  );
});

test("the antipode, and S² = id on the commutative one", () => {
  same(["Antipode", H(1)], ["Negate", H(1)]);
  same(["Antipode", M(1)], ["Negate", M(1)]);
  same(["Antipode", ["Antipode", M(1, 2)]], M(1, 2));
  same(["Antipode", ["Antipode", M(2, 1)]], M(2, 1));
});

test("the counit and the degree", () => {
  same(["Counit", H()], 1);
  same(["Counit", H(2)], 0);
  same(["HopfDegree", M(1, 2)], 3);
  same(["HopfDegree", times(M(1), M(2))], 3); // the product is homogeneous
  // A sum of mixed degrees has no degree, so the call stays put.
  expect(ce.box(["HopfDegree", ["Add", M(1), M(2)]]).evaluate().operator).toBe("HopfDegree");
});

test("the graded pieces have 2^(n−1) basis elements", () => {
  same(["AlgebraDimension", ["NSymAlgebra", 4]], 8);
  same(["AlgebraDimension", ["QSymAlgebra", 5]], 16);
  same(["AlgebraDimension", ["QSymAlgebra", 0]], 1);
  const basis = ce.box(["Basis", ["NSymAlgebra", 3]]).evaluate().json as unknown as unknown[];
  expect(basis.length - 1).toBe(4);
});

test("containment is by degree and by algebra", () => {
  same(["Element", H(1, 3), ["NSymAlgebra", 4]], "True");
  same(["Element", H(1, 3), ["NSymAlgebra", 5]], "False");
  // The two algebras share an index set but are not the same algebra.
  same(["Element", M(1, 3), ["NSymAlgebra", 4]], "False");
  same(["Element", M(1, 3), ["QSymAlgebra", 4]], "True");
});

test("mixing the two algebras in one product is refused", () => {
  expect(ce.box(times(H(1), M(1))).evaluate().operator).toBe("NonCommutativeMultiply");
});

test("a malformed composition is not a basis element", () => {
  expect(ce.box(["NSymH", ["List", 0, 2]]).evaluate().operator).toBe("NSymH");
  expect(ce.box(["Coproduct", ["NSymH", ["List", -1]]]).evaluate().operator).toBe("Coproduct");
});

test("the ribbon basis of NSym is a first-class basis, not a conversion step", () => {
  const R = (...parts: number[]): Expr => ["NSymR", ["List", ...parts]];
  const H = (...parts: number[]): Expr => ["NSymH", ["List", ...parts]];
  // R_(2) = H_(2), and R_(1,1) = H_(1,1) − H_(2).
  same(["InCompleteBasis", R(2)], H(2));
  same(["InCompleteBasis", R(1, 1)], ["Add", H(1, 1), ["Multiply", -1, H(2)]]);
  same(["InRibbonBasis", H(2)], R(2));
  // …and the round trip is the identity.
  same(["InRibbonBasis", ["InCompleteBasis", R(2, 1)]], R(2, 1));
  // The product stays in the basis it was given in, and has exactly two terms.
  same(["CircleTimes", R(2), R(1)], ["Add", R(2, 1), R(3)]);
  same(["CircleTimes", R(1), R(1)], ["Add", R(1, 1), R(2)]);
});

test("the antipode on a ribbon is one signed term", () => {
  const R = (...parts: number[]): Expr => ["NSymR", ["List", ...parts]];
  same(["Antipode", R(3)], ["Multiply", -1, R(1, 1, 1)]);
  same(["Antipode", R(1, 1, 1)], ["Multiply", -1, R(3)]);
  same(["Antipode", R(2, 1)], ["Multiply", -1, R(2, 1)]); // self-conjugate
  same(["ConjugateComposition", ["List", 3]], ["List", 1, 1, 1]);
  same(["ConjugateComposition", ["List", 2, 1]], ["List", 2, 1]);
});

test("the fundamental basis of QSym", () => {
  const F = (...parts: number[]): Expr => ["QSymF", ["List", ...parts]];
  const M = (...parts: number[]): Expr => ["QSymM", ["List", ...parts]];
  // F_(2) = M_(2) + M_(1,1); the fundamental basis sums over refinements.
  same(["InMonomialBasis", F(2)], ["Add", M(1, 1), M(2)]);
  same(["InMonomialBasis", F(1, 1)], M(1, 1));
  same(["InFundamentalBasis", M(1, 1)], F(1, 1));
  same(["InFundamentalBasis", ["InMonomialBasis", F(2, 1)]], F(2, 1));
  // F_(1) · F_(1) = F_(2) + F_(1,1) — the shuffle of two single letters.
  same(["CircleTimes", F(1), F(1)], ["Add", F(1, 1), F(2)]);
});

test("a basis belongs to its own algebra, and conversions refuse to cross", () => {
  const R = (...parts: number[]): Expr => ["NSymR", ["List", ...parts]];
  const F = (...parts: number[]): Expr => ["QSymF", ["List", ...parts]];
  // Ribbons are in NSym whichever basis they are written in.
  same(["Element", R(2, 1), ["NSymAlgebra", 3]], "True");
  same(["Element", R(2, 1), ["QSymAlgebra", 3]], "False");
  same(["HopfDegree", R(2, 1)], 3);
  // Converting an NSym element into a QSym basis is not a thing.
  expect(ce.box(["InFundamentalBasis", R(2)]).evaluate().operator).toBe("InFundamentalBasis");
  expect(ce.box(["InRibbonBasis", F(2)]).evaluate().operator).toBe("InRibbonBasis");
  // …and the two algebras still do not mix under a product.
  expect(ce.box(["CircleTimes", R(1), F(1)]).evaluate().operator).toBe("CircleTimes");
});
