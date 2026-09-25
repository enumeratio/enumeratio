import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHypercomplex } from "../src/declare.ts";

const ce = new ComputeEngine();
declareHypercomplex(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

test("Quaternions IS Cl(0,2), with basis (1, i, j, k)", () => {
  same(["Basis", "Quaternions"], ["List", 1, "f_1", "f_2", ["Multiply", "f_1", "f_2"]]);
  same(["Basis", ["CliffordAlgebra", 0, 2]], ["Basis", "Quaternions"]);
  same(["AlgebraDimension", "Quaternions"], 4);
  same(["AlgebraSignature", "Quaternions"], ["List", -1, -1]);
});

test("CliffordAlgebra(p, q) splits its generators by square", () => {
  same(["AlgebraSignature", ["CliffordAlgebra", 2, 1]], ["List", 1, 1, -1]);
  same(["AlgebraDimension", ["CliffordAlgebra", 2, 1]], 8);
  same(["AlgebraDimension", ["CliffordAlgebra", 3]], 8); // q defaults to 0
  same(["Basis", ["CliffordAlgebra", 1, 1]], ["List", 1, "e_1", "f_1", ["Multiply", "e_1", "f_1"]]);
});

test("the commuting constructors name their own families", () => {
  same(["AlgebraSignature", ["MulticomplexAlgebra", 3]], ["List", -1, -1, -1]);
  same(["AlgebraSignature", ["SplitAlgebra", 2]], ["List", 1, 1]);
  same(["AlgebraSignature", ["DualAlgebra", 2]], ["List", 0, 0]);
  same(["AlgebraSignature", ["GrassmannAlgebra", 2]], ["List", 0, 0]);
  same(["AlgebraDimension", ["MulticomplexAlgebra", 4]], 16);
  same(
    ["Basis", ["MulticomplexAlgebra", 2]],
    ["List", 1, "i_1", "i_2", ["Multiply", "i_1", "i_2"]],
  );
});

test("an element is Dot(coefficients, Basis(algebra))", () => {
  // No constructor head needed — Dot already threads a coefficient tuple over the basis.
  same(
    ["Dot", ["List", 1, 2, 3, 4], ["Basis", "Quaternions"]],
    ["Add", 1, ["Multiply", 2, "f_1"], ["Multiply", 3, "f_2"], ["Multiply", 4, "f_1", "f_2"]],
  );
  // And the element then multiplies as a quaternion: (0,1,0,0)·(0,0,1,0) = k.
  same(
    [
      "NonCommutativeMultiply",
      ["Dot", ["List", 0, 1, 0, 0], ["Basis", "Quaternions"]],
      ["Dot", ["List", 0, 0, 1, 0], ["Basis", "Quaternions"]],
    ],
    ["Multiply", "f_1", "f_2"],
  );
});

test("a constructor stays inert, and native Dimension is untouched", () => {
  expect(ce.box(["CliffordAlgebra", 0, 2]).evaluate().operator).toBe("CliffordAlgebra");
  expect(ce.box(["Basis", ["CliffordAlgebra", "p", 2]]).evaluate().operator).toBe("Basis");
  // `Dimension` was deliberately NOT widened to accept an algebra.
  expect(ce.box(["Dimension", ["List", 1, 2, 3]]).evaluate().json).toEqual(
    new ComputeEngine().box(["Dimension", ["List", 1, 2, 3]]).evaluate().json,
  );
});

test("⊗ is total, not Clifford-only: it works on scalars and commuting units", () => {
  // A tensor product of two scalars is multiplication (the implied identity factor),
  // and on commuting generators ⊗ just agrees with ×.
  same(["CircleTimes", 2, 3], 6);
  same(["CircleTimes", "a", "b"], ["Multiply", "a", "b"]);
  same(["CircleTimes", "i_1", "i_2"], ["Multiply", "i_1", "i_2"]);
  same(["CircleTimes", "i_2", "i_1"], ["Multiply", "i_1", "i_2"]);
  same(
    ["CircleTimes", ["Add", 1, "i_1"], ["Add", 1, "i_2"]],
    ["Multiply", ["Add", 1, "i_1"], ["Add", 1, "i_2"]],
  );
});

test("the named algebras are the literature's names for fixed sizes", () => {
  same(["AlgebraSignature", "BicomplexNumbers"], ["List", -1, -1]);
  same(["Basis", "BicomplexNumbers"], ["Basis", ["MulticomplexAlgebra", 2]]);
  same(["AlgebraSignature", "TricomplexNumbers"], ["List", -1, -1, -1]);
  same(["AlgebraSignature", "SplitComplexNumbers"], ["List", 1]);
  same(["AlgebraSignature", "DualNumbers"], ["List", 0]);
  same(["AlgebraDimension", "SplitComplexNumbers"], 2);
  same(["Basis", "DualNumbers"], ["List", 1, "epsilon_1"]);
  // `\mathbb{H}` parses to its own symbol; it names ℍ too.
  expect(ce.parse("z \\in \\mathbb{H}").json).toEqual(["Element", "z", "H_doublestruck"]);
  same(["Basis", "H_doublestruck"], ["Basis", "Quaternions"]);
});

test("the algebras work as SETS: containment answers on the units present", () => {
  same(["Element", ["Multiply", "f_1", "f_2"], "Quaternions"], "True");
  same(["Element", "f_1", "Quaternions"], "True");
  same(["Element", 2, "Quaternions"], "True"); // scalars are in every algebra
  same(["Element", "f_3", "Quaternions"], "False"); // ℍ has only two generators
  same(["Element", "i_1", "Quaternions"], "False");
  same(["Element", "i_1", "BicomplexNumbers"], "True");
  same(["Element", "i_3", "BicomplexNumbers"], "False");
  same(["Element", ["Add", 1, "epsilon_1"], "DualNumbers"], "True");
  same(["Element", "j_1", "SplitComplexNumbers"], "True");
});

test("containment declines rather than guessing, and native Element is untouched", () => {
  // A free symbol reads as a scalar; claiming x ∈ ℍ from that would be presumptuous.
  expect(ce.box(["Element", "x", "Quaternions"]).evaluate().operator).toBe("Element");
  same(["Element", 2, "Integers"], "True");
  same(["Element", ["Divide", 1, 2], "Integers"], "False");
  same(["Element", ["Divide", 1, 2], "RationalNumbers"], "True");
});
