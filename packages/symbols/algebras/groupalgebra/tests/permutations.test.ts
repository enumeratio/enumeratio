import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareGroupAlgebra } from "../src/declare.ts";

const ce = new ComputeEngine();
declareGroupAlgebra(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const C = (...cycles: readonly number[][]): Expr => ["Cycles", L(...cycles.map((c) => L(...c)))];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

// Every expected value below was cross-checked against a Wolfram kernel.

test("Cycles drops fixed points, keeps everything else", () => {
  same(["Cycles", L(L(1, 3, 2), L(5), L(4))], C([1, 3, 2]));
  same(C([1, 3, 2]), C([1, 3, 2])); // already canonical -- unchanged
});

test("PermutationCycles: one-line word -> cycle notation", () => {
  same(["PermutationCycles", L(2, 5, 3, 6, 1, 8, 7, 9, 4, 10)], C([1, 2, 5], [4, 6, 8, 9]));
  same(["PermutationCycles", L(1, 2, 3, 4, 5)], C()); // identity -> no cycles
  same(["PermutationCycles", L(6, 3, 2, 5, 4, 1)], C([1, 6], [2, 3], [4, 5]));
});

test("PermutationCycles with a custom head keeps fixed points as singletons", () => {
  same(
    ["PermutationCycles", L(2, 5, 3, 6, 1, 8, 7, 9, 4, 10), "head"],
    ["head", L(L(1, 2, 5), L(3), L(4, 6, 8, 9), L(7), L(10))],
  );
  // Identity(x) evaluates straight through to x, so check the fully-simplified result
  // (a second `.evaluate()`, since our handler hands back `Identity(...)` unevaluated)
  // rather than compare against an un-evaluated Identity(...) wrapper.
  expect(
    ce
      .box(["PermutationCycles", L(1, 2, 3, 4, 5), "Identity"])
      .evaluate()
      .evaluate().json,
  ).toEqual(ce.box(L(L(1), L(2), L(3), L(4), L(5))).evaluate().json);
});

test("PermutationCycles on an already-Cycles value is the identity", () => {
  same(["PermutationCycles", C([1, 3, 5], [2, 4, 6])], C([1, 3, 5], [2, 4, 6]));
});

test("InversePermutation: one-line and cycle notation", () => {
  same(["InversePermutation", L(2, 5, 3, 6, 1, 8, 7, 9, 4, 10)], L(5, 1, 3, 9, 2, 4, 7, 6, 8, 10));
  same(["InversePermutation", C([1, 2, 5], [4, 6, 8, 9])], C([1, 5, 2], [4, 9, 8, 6]));
});

test("Permute: moves the item at position i to position sigma(i)", () => {
  same(["Permute", L("a", "b", "c", "d"), C([1, 3, 2])], L("b", "c", "a", "d"));
  same(["Permute", L("a", "b", "c", "d"), C([1, 3], [2, 4])], L("c", "d", "a", "b"));
  same(["Permute", L("a", "b", "c", "d"), L(2, 3, 4, 1)], L("d", "a", "b", "c"));
});

test("Permute by a PermutationGroup broadcasts over every element, in GroupElements order", () => {
  same(
    ["Permute", L("a", "b", "c"), ["PermutationGroup", L(C([1, 2, 3]))]],
    L(L("a", "b", "c"), L("c", "a", "b"), L("b", "c", "a")),
  );
});

test("GroupOrder(PermutationGroup(...)) by BFS closure", () => {
  same(["GroupOrder", ["PermutationGroup", L(C([1, 9, 6], [3, 7]))]], 6);
  // S4: a 4-cycle and a transposition generate the whole symmetric group.
  same(["GroupOrder", ["PermutationGroup", L(C([1, 2, 3, 4]), C([1, 2]))]], 24);
  same(["GroupOrder", ["PermutationGroup", L()]], 1);
  // Dihedral group of the square, as a PermutationGroup of generators: rotation + a flip.
  same(["GroupOrder", ["PermutationGroup", L(C([1, 2, 3, 4]), C([1, 3]))]], 8);
});

test("GroupElements(PermutationGroup(...)), with and without a position selector", () => {
  const all = C([]),
    c37 = C([3, 7]),
    c169 = C([1, 6, 9]);
  const full = ["PermutationGroup", L(C([1, 9, 6], [3, 7]))] as const;
  same(["GroupElements", full], L(all, c37, c169, C([1, 6, 9], [3, 7]), C([1, 9, 6]), C([1, 9, 6], [3, 7])));
  same(["GroupElements", full, L(1, 2, 3)], L(all, c37, c169));
  same(["GroupElements", full, L(-1)], L(C([1, 9, 6], [3, 7])));
});

test("GroupGenerators(PermutationGroup(...)) returns the given generators", () => {
  same(["GroupGenerators", ["PermutationGroup", L(C([1, 9, 6], [3, 7]))]], L(C([1, 9, 6], [3, 7])));
});

test("PermutationCycles still computes when another library declared the name first", () => {
  // @enumeratio/domains' carrier constructor: held, no evaluate -- the page engine's order.
  const shared = new ComputeEngine();
  shared.declare("PermutationCycles", { signature: "(list<integer>) -> value" });
  declareGroupAlgebra(shared);
  expect(shared.box(["PermutationCycles", L(6, 3, 2, 5, 4, 1)]).evaluate().json).toEqual(
    shared.box(C([1, 6], [2, 3], [4, 5])).evaluate().json,
  );
});

test("a list that is not a permutation is left unevaluated, not crashed on", () => {
  for (const head of ["PermutationCycles", "InversePermutation"]) {
    same([head, L(1, 1, 2)], [head, L(1, 1, 2)]);
    same([head, L(1, 4)], [head, L(1, 4)]);
  }
  same(["Permute", L(7, 8, 9), L(1, 1, 2)], ["Permute", L(7, 8, 9), L(1, 1, 2)]);
});
