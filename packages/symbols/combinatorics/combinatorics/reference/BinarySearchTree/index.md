---
name: BinarySearchTree
domain: Combinatorial maps
signature: BinarySearchTree(Permutation)
summary: The tree built by inserting σ(1), σ(2), ... into an empty binary search tree.
seeAlso:
  - BinaryTree
  - BinarySearchTreeParentArray
references:
  - system: wikipedia
    identity: Binary search tree
mapOn:
  - Permutation
signatures:
  - call: BinarySearchTree(Permutation)
    description: The tree built by inserting σ(1), σ(2), ... into an empty binary search tree.
    library: enumeratio-combinatorics
    type: (permutation) -> binary_tree
---

- Takes a `Permutation` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[BinaryTree]] after [[BinarySearchTreeParentArray]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- The sylvester congruence: two permutations land on the same tree exactly when they agree on which of any pair is inserted first. Built as its parent array (BinarySearchTreeParentArray), then read as a tree.
