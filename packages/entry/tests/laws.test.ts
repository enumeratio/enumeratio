// Pins what the `laws:` shorthand vocabulary MEANS: a change to `expandLaw`'s output is a
// change to every record that uses it, so this holds the shorthand and its expansion together
// (https://github.com/enumeratio/enumeratio/wiki/Plausible §4.2 -- design §6's ForAll vocabulary).

import { expect, test } from "vite-plus/test";
import { expandLaw, type LawContext, lawsFor } from "../src/laws.ts";

const REVERSE: LawContext = { name: "Reverse", from: "permutation", to: "permutation" };

test("involution", () => {
  expect(expandLaw("involution", REVERSE)).toEqual({
    law: "involution",
    typed: ["ForAll", ["Element", "x", "permutation"], ["Element", ["Reverse", "x"], "permutation"]],
    statement: ["ForAll", ["Element", "x", "permutation"], ["Equal", ["Reverse", ["Reverse", "x"]], "x"]],
  });
});

test("idempotent", () => {
  const ctx: LawContext = { name: "KnuthClassRepresentative", from: "permutation", to: "permutation" };
  expect(expandLaw("idempotent", ctx).statement).toEqual([
    "ForAll",
    ["Element", "x", "permutation"],
    ["Equal", ["KnuthClassRepresentative", ["KnuthClassRepresentative", "x"]], ["KnuthClassRepresentative", "x"]],
  ]);
});

test("inverse", () => {
  const ctx: LawContext = { name: "CycleDecomposition", from: "permutation", to: "cycle_decomposition" };
  expect(expandLaw({ inverse: "Permutation" }, ctx).statement).toEqual([
    "ForAll",
    ["Element", "x", "permutation"],
    ["Equal", ["Permutation", ["CycleDecomposition", "x"]], "x"],
  ]);
});

test("inverse with `on`, for a shared name's own overload", () => {
  const ctx: LawContext = { name: "BinaryTree", from: "dyck_path", to: "binary_tree" };
  expect(expandLaw({ inverse: "DyckPath", on: "dyck_path" }, ctx).statement).toEqual([
    "ForAll",
    ["Element", "x", "dyck_path"],
    ["Equal", ["DyckPath", ["BinaryTree", "x"]], "x"],
  ]);
});

test("orderIsomorphism", () => {
  const ctx: LawContext = { name: "CutWord", from: "composition", to: "binary_word" };
  const law = { orderIsomorphism: { from: "IntegerCompositions", to: "BinaryWords", sizeOffset: -1 } } as const;
  expect(expandLaw(law, ctx).statement).toEqual([
    "ForAll",
    [
      "And",
      ["Element", "n", "NonNegativeIntegers"],
      ["Element", "k", "PositiveIntegers"],
      ["LessEqual", "k", ["Count", ["At", "IntegerCompositions", "n"]]],
    ],
    [
      "Equal",
      ["CutWord", ["At", ["At", "IntegerCompositions", "n"], "k"]],
      ["At", ["At", "BinaryWords", ["Add", "n", -1]], "k"],
    ],
  ]);
});

test("every law's typed statement names its own from/to, not the law's target", () => {
  const ctx: LawContext = { name: "DyckPath", from: "binary_tree", to: "dyck_path" };
  expect(expandLaw({ inverse: "BinaryTree" }, ctx).typed).toEqual([
    "ForAll",
    ["Element", "x", "binary_tree"],
    ["Element", ["DyckPath", "x"], "dyck_path"],
  ]);
});

test("lawsFor keeps a law with no `on`, and one whose `on` matches", () => {
  const laws = [
    "involution",
    { inverse: "BinaryTreeParentArray", on: "binary_tree_parent_array" },
    { inverse: "DyckPath", on: "dyck_path" },
  ] as const;
  expect(lawsFor(laws, "dyck_path")).toEqual(["involution", { inverse: "DyckPath", on: "dyck_path" }]);
});

test("lawsFor with no laws is empty", () => {
  expect(lawsFor(undefined, "permutation")).toEqual([]);
});
