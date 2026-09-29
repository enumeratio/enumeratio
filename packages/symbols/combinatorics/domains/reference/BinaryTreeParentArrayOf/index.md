---
name: BinaryTreeParentArrayOf
domain: Combinatorial maps
signature: BinaryTreeParentArrayOf(BinaryTree)
summary: "A binary tree as its parent array: its nodes numbered in order, entry k the number of the k-th node's parent, 0 at the root."
signatures:
  - call: BinaryTreeParentArrayOf(BinaryTree)
    description: "A binary tree as its parent array: its nodes numbered in order, entry k the number of the k-th node's parent, 0 at the root."
    library: enumeratio-domains
    type: (binary_tree) -> binary_tree_parent_array
---

- Takes a `BinaryTree` and returns a `BinaryTreeParentArray` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- An order isomorphism: the k-th tree BinaryTrees lists goes to the k-th array BinaryTreeParentArrays lists.
