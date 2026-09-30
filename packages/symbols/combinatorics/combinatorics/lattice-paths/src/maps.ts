// The one combinatorial map whose `from` carrier is `dyck_path` (step 6c). Its body comes from
// trees' `binary-tree.ts`, which also backs the two maps trees owns itself
// (`../../trees/src/maps.ts`) — the inverse direction of the bijection lives here because a
// map's area is decided by its SOURCE carrier, not the module its body happens to share.

import type { CombinatorialMap } from "../../src/map-helpers.ts";
import { treeOfDyckPathBody, treeOfDyckPathGuard } from "../../trees/src/binary-tree.ts";

export const LATTICE_PATHS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "BinaryTree",
    convert: true,
    from: "dyck_path",
    to: "binary_tree",
    body: treeOfDyckPathBody,
    guard: treeOfDyckPathGuard,
    summary: "A Dyck path U A D B, cut at its first return, as the binary tree [φ⁻¹(A), φ⁻¹(B)].",
    laws: [{ inverse: "DyckPath" }],
  },
];
