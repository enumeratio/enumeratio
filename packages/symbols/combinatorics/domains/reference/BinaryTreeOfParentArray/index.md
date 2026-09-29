---
name: BinaryTreeOfParentArray
domain: Combinatorial maps
signature: BinaryTreeOfParentArray(BinaryTreeParentArray)
summary: "The binary tree an in-order parent array describes: a node below its parent goes left, above it right."
signatures:
  - call: BinaryTreeOfParentArray(BinaryTreeParentArray)
    description: "The binary tree an in-order parent array describes: a node below its parent goes left, above it right."
    library: enumeratio-domains
    type: (binary_tree_parent_array) -> binary_tree
---

- Takes a `BinaryTreeParentArray` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Declines an array that isn't one: two roots, two left children, a cycle, or labels out of order.
