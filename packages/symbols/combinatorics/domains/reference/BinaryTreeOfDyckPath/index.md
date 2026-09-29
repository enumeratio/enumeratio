---
name: BinaryTreeOfDyckPath
domain: Combinatorial maps
signature: BinaryTreeOfDyckPath(DyckPath)
summary: A Dyck path U A D B, cut at its first return, as the binary tree [φ⁻¹(A), φ⁻¹(B)].
signatures:
  - call: BinaryTreeOfDyckPath(DyckPath)
    description: A Dyck path U A D B, cut at its first return, as the binary tree [φ⁻¹(A), φ⁻¹(B)].
    library: enumeratio-domains
    type: (dyck_path) -> binary_tree
---

- Takes a `DyckPath` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
