import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareQuiver } from "../src/declare.ts";

const ce = new ComputeEngine();
declareQuiver(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const P = (start: number, ...arrows: number[]): Expr => ["QuiverPath", start, ["List", ...arrows]];
const A4: Expr = ["LinearQuiver", 4];

test("acyclic quivers have a dimension; cyclic ones do not", () => {
  same(["AlgebraDimension", ["PathAlgebra", A4]], 10); // C(5,2)
  same(["AlgebraDimension", ["PathAlgebra", ["LinearQuiver", 6]]], 21);
  same(["AlgebraDimension", ["PathAlgebra", "KroneckerQuiver"]], 4);
  same(["QuiverIsAcyclic", A4], "True");
  same(["QuiverIsAcyclic", "JordanQuiver"], "False");
  // A loop means infinitely many paths, so there is no dimension and no basis.
  expect(ce.box(["AlgebraDimension", ["PathAlgebra", "JordanQuiver"]]).evaluate().operator).toBe(
    "AlgebraDimension",
  );
  expect(ce.box(["Basis", ["PathAlgebra", "JordanQuiver"]]).evaluate().operator).toBe("Basis");
});

test("composition concatenates, or gives zero", () => {
  same(["QuiverCompose", A4, P(1, 0), P(2, 1)], P(1, 0, 1)); // 1→2 then 2→3
  same(["QuiverCompose", A4, P(2, 1), P(1, 0)], 0); // ends do not meet
  // Trivial paths are the local identities.
  same(["QuiverCompose", A4, P(1), P(1, 0)], P(1, 0));
  same(["QuiverCompose", A4, P(1, 0), P(2)], P(1, 0));
});

test("an explicit quiver, with parallel arrows", () => {
  const kronecker: Expr = ["Quiver", 2, L(L(1, 2), L(1, 2))];
  same(["AlgebraDimension", ["PathAlgebra", kronecker]], 4);
  // The two arrows are distinct basis elements despite sharing endpoints.
  same(["QuiverPathEnd", kronecker, P(1, 0)], 2);
  same(["QuiverPathEnd", kronecker, P(1, 1)], 2);
  expect(ce.box(["QuiverCompose", kronecker, P(1, 0), P(1, 1)]).evaluate().json).toBe(0);
});

test("containment tests whether a path is a path of this quiver", () => {
  same(["Element", P(1, 0), ["PathAlgebra", A4]], "True");
  same(["Element", P(1, 1), ["PathAlgebra", A4]], "False"); // arrow 1 starts at vertex 2
  same(["Element", P(9), ["PathAlgebra", A4]], "False");
});

test("the basis lists the paths", () => {
  const basis = ce.box(["Basis", ["PathAlgebra", ["LinearQuiver", 3]]]).evaluate()
    .json as unknown as unknown[];
  expect(basis.length - 1).toBe(6);
});

test("a malformed quiver leaves the call alone", () => {
  expect(
    ce.box(["AlgebraDimension", ["PathAlgebra", ["Quiver", 2, L(L(1, 5))]]]).evaluate().operator,
  ).toBe("AlgebraDimension");
  expect(ce.box(["QuiverIsAcyclic", ["LinearQuiver", 0]]).evaluate().operator).toBe(
    "QuiverIsAcyclic",
  );
});
