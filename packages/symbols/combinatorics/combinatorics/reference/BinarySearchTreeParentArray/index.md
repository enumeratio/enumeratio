---
name: BinarySearchTreeParentArray
domain: Combinatorial maps
signature: BinarySearchTreeParentArray(Permutation)
summary: "The binary search tree of σ as its parent array: entry v is the value v is inserted under, 0 for the root."
signatures:
  - call: BinarySearchTreeParentArray(Permutation)
    description: "The binary search tree of σ as its parent array: entry v is the value v is inserted under, 0 for the root."
    library: enumeratio-combinatorics
    type: (permutation) -> binary_tree_parent_array
---

- Takes a `Permutation` and returns a `BinaryTreeParentArray` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- A search tree's values are its in-order labels, so this is the tree's in-order parent array. See bst.ts for why a fold builds it this way.
