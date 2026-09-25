import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { expect, test } from "vite-plus/test";
import { declareDiagrams } from "../src/declare.ts";

const ce = new ComputeEngine();
// Declared alongside the hypercomplex library on purpose: both wrap `Basis`,
// `AlgebraDimension`, `Element` and the ordered product, and each defers to whatever
// was there before, so the two have to compose.
declareHypercomplex(ce);
declareDiagrams(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const evaluated = (input: Expr) => ce.box(input).evaluate().json;

/** A diagram from blocks of signed labels. */
const D = (...blocks: number[][]): Expr => ["Diagram", ["List", ...blocks.map((b) => ["List", ...b] as Expr)]];
const times = (...parts: Expr[]): Expr => ["NonCommutativeMultiply", ...parts];

test("dimensions come back from the closed form, past the basis limit", () => {
  same(["AlgebraDimension", ["TemperleyLiebAlgebra", 3]], 5);
  same(["AlgebraDimension", ["PartitionAlgebra", 3]], 203);
  same(["AlgebraDimension", ["BrauerAlgebra", 4]], 105);
  same(["AlgebraDimension", ["SymmetricGroupAlgebra", 5]], 120);
  same(["AlgebraDimension", ["MotzkinAlgebra", 3]], 51);
  same(["AlgebraDimension", ["RookAlgebra", 3]], 34);
  // A basis of 4140 diagrams is not useful inline; the dimension still is.
  same(["AlgebraDimension", ["PartitionAlgebra", 4]], 4140);
  expect(ce.box(["Basis", ["PartitionAlgebra", 4]]).evaluate().operator).toBe("Basis");
});

test("Basis lists the diagrams, and its length is the dimension", () => {
  for (const [head, n, dim] of [
    ["TemperleyLiebAlgebra", 3, 5],
    ["BrauerAlgebra", 3, 15],
    ["PartitionAlgebra", 2, 15],
    ["SymmetricGroupAlgebra", 3, 6],
  ] as const) {
    const basis = ce.box(["Basis", [head, n]]).evaluate().json as unknown as unknown[];
    expect(basis[0]).toBe("List");
    expect(basis.length - 1, `${head}(${n})`).toBe(dim);
  }
});

test("the product closes loops into powers of δ", () => {
  // e₁ on two strands is the cup-cap; e₁² = δ·e₁ is THE Temperley–Lieb relation.
  const e1 = D([1, 2], [-1, -2]);
  same(times(e1, e1), ["Multiply", "delta", e1]);
  same(times(e1, e1, e1), ["Multiply", ["Power", "delta", 2], e1]);
  // The identity closes nothing.
  const id = D([1, -1], [2, -2]);
  same(times(id, e1), e1);
  same(times(id, id), id);
});

test("e₁e₂e₁ = e₁ in TL₃, through the heads", () => {
  const e1 = D([1, 2], [-1, -2], [3, -3]);
  const e2 = D([2, 3], [-2, -3], [1, -1]);
  same(times(e1, e2, e1), e1);
  same(times(e2, e1, e2), e2);
  same(times(e1, e1), ["Multiply", "delta", e1]);
});

test("containment distinguishes the subalgebras", () => {
  const crossing = D([1, -2], [2, -1], [3, -3]);
  const cup = D([1, 2], [-1, -2], [3, -3]);
  same(["Element", crossing, ["BrauerAlgebra", 3]], "True");
  same(["Element", crossing, ["TemperleyLiebAlgebra", 3]], "False"); // not planar
  same(["Element", crossing, ["SymmetricGroupAlgebra", 3]], "True");
  same(["Element", cup, ["TemperleyLiebAlgebra", 3]], "True");
  same(["Element", cup, ["SymmetricGroupAlgebra", 3]], "False"); // not a permutation
  // A block of three is a partition diagram and nothing smaller.
  const triple = D([1, 2, -1], [3, -3], [-2]);
  same(["Element", triple, ["PartitionAlgebra", 3]], "True");
  same(["Element", triple, ["BrauerAlgebra", 3]], "False");
  // Wrong strand count.
  same(["Element", D([1, -1]), ["TemperleyLiebAlgebra", 3]], "False");
});

test("a malformed diagram stays as written rather than being guessed at", () => {
  // Point −2 is missing, and a diagram partitions ALL 2n points — so this is malformed
  // rather than a diagram with an implicit singleton.
  const missing: Expr = ["Diagram", ["List", ["List", 1, -1], ["List", 2]]];
  expect(evaluated(missing)).toEqual(["Diagram", ["List", ["List", 1, -1], ["List", 2]]]);
  // A product of diagrams on different strand counts is not a product at all.
  expect(ce.box(times(D([1, -1]), D([1, 2], [-1, -2]))).evaluate().operator).toBe("NonCommutativeMultiply");
});

test("the carrier normalises, so a written diagram equals a computed one", () => {
  // Blocks come back in canonical order whichever way they were written.
  same(D([-1, -2], [3, -3], [1, 2]), D([1, 2], [-1, -2], [3, -3]));
  same(D([2, 1], [-2, -1], [-3, 3]), D([1, 2], [-1, -2], [3, -3]));
});

test("the hypercomplex library still answers alongside this one", () => {
  // Both wrap the same accessors; each defers, so neither clobbers the other.
  same(["AlgebraDimension", "Quaternions"], 4);
  same(["Basis", "Quaternions"], ["List", 1, "f_1", "f_2", ["Multiply", "f_1", "f_2"]]);
  same(["Element", ["Multiply", "f_1", "f_2"], "Quaternions"], "True");
  same(["NonCommutativeMultiply", "e_2", "e_1"], ["Negate", ["Multiply", "e_1", "e_2"]]);
  same(["Norm", ["Add", 3, ["Multiply", 4, "i_1"]]], 25);
  // ...and native arithmetic is still native.
  same(["Add", 2, 3], 5);
  same(["Element", 2, "Integers"], "True");
});

test("the orbit basis is the partition lattice's Möbius inversion of the diagram basis", () => {
  const D = (...blocks: number[][]): Expr => ["Diagram", ["List", ...blocks.map((b) => ["List", ...b] as Expr)]];
  const X = (...blocks: number[][]): Expr => ["OrbitDiagram", ["List", ...blocks.map((b) => ["List", ...b] as Expr)]];
  // The coarsest partition of 2 points has nothing above it, so the bases agree there.
  same(["InOrbitBasis", D([1, -1])], X([1, -1]));
  same(["InDiagramBasis", X([1, -1])], D([1, -1]));
  // The finest partition of two points expands over both partitions: d = x_fine + x_coarse.
  same(["InOrbitBasis", ["Diagram", ["List", ["List", 1], ["List", -1]]]], ["Add", X([1], [-1]), X([1, -1])]);
  // …and back the other way the coarser term is subtracted.
  same(
    ["InDiagramBasis", ["OrbitDiagram", ["List", ["List", 1], ["List", -1]]]],
    ["Add", D([1], [-1]), ["Multiply", -1, D([1, -1])]],
  );
  // The round trip is the identity.
  same(["InOrbitBasis", ["InDiagramBasis", X([1], [-1])]], X([1], [-1]));
});

test("the Möbius function, and how many coarsenings there are", () => {
  // Merging all four points of a 2-strand diagram: (−1)³·3! = −6.
  const finest = ["Diagram", ["List", ["List", 1], ["List", 2], ["List", -1], ["List", -2]]] as Expr;
  const coarsest = ["Diagram", ["List", ["List", 1, 2, -1, -2]]] as Expr;
  same(["PartitionMobius", finest, coarsest], -6);
  same(["PartitionMobius", finest, finest], 1);
  // Coarsening is partitioning the blocks, so there are Bell(4) = 15 of them.
  const list = ce.box(["DiagramCoarsenings", finest]).evaluate().json as unknown as unknown[];
  expect(list.length - 1).toBe(15);
  // The wrong way round has no value at all.
  expect(ce.box(["PartitionMobius", coarsest, finest]).evaluate().operator).toBe("PartitionMobius");
});
