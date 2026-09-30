// src/maps-laws.generated.ts is current with every map's own record.
// Regenerate with `vp node packages/symbols/combinatorics/combinatorics/scripts/generate-map-laws.ts`.

import { expect, test } from "vite-plus/test";
import { mapLaws } from "../scripts/generate-map-laws.ts";
import { MAP_LAWS } from "../src/maps-laws.generated.ts";

test("the generated map laws match every map's record", () => {
  expect(Object.fromEntries(mapLaws())).toEqual(MAP_LAWS);
});

test("MAPS merges each map's generated laws by name@from", async () => {
  const { MAPS } = await import("../src/maps.ts");
  const reverse = MAPS.find((m) => m.name === "Reverse" && m.from === "permutation");
  expect(reverse?.laws).toEqual(["involution"]);
  const binaryTreeFromArray = MAPS.find((m) => m.name === "BinaryTree" && m.from === "binary_tree_parent_array");
  expect(binaryTreeFromArray?.laws).toEqual([{ inverse: "BinaryTreeParentArray" }]);
  expect(binaryTreeFromArray?.orderIsomorphism).toEqual({ from: "BinaryTreeParentArrays", to: "BinaryTrees" });
  const binaryTreeFromDyck = MAPS.find((m) => m.name === "BinaryTree" && m.from === "dyck_path");
  expect(binaryTreeFromDyck?.laws).toEqual([{ inverse: "DyckPath" }]);
  expect(binaryTreeFromDyck?.orderIsomorphism).toBeUndefined();
  // No record for this one (see permutations/src/maps.ts) -- its inline law survives the merge.
  const permutation = MAPS.find((m) => m.name === "Permutation" && m.from === "cycle_decomposition");
  expect(permutation?.laws).toEqual([{ inverse: "CycleDecomposition" }]);
});
