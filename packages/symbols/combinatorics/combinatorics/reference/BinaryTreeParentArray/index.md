---
name: BinaryTreeParentArray
domain: Collections
signature: BinaryTreeParentArray(list)
catalogCarrier: true
summary: "The singular-inhabitant constructor for a binary tree as its in-order parent array: entry k is the k-th node's parent, 0 at the root."
signatures:
  - call: BinaryTreeParentArray(list)
    description: "The singular-inhabitant constructor for a binary tree as its in-order parent array: entry k is the k-th node's parent, 0 at the root."
    library: enumeratio-combinatorics
    type: ((list<integer>) -> binary_tree_parent_array) & ((binary_tree) -> binary_tree_parent_array)
seeAlso:
  - BinaryTreeParentArrays
  - BinaryTree
laws:
  - inverse: BinaryTree
  - orderIsomorphism:
      from: BinaryTrees
      to: BinaryTreeParentArrays
---

- Number the nodes in order. A node numbered below its parent is its left child, above it its right, so parentage alone fixes the tree: $2023$ is a root 2 with left child 1 and right child 3, and 4 to the right of 3.
- A binary search tree's values are its in-order numbers, which makes this what `BinarySearchTreeParentArray` builds. The same structure as a `BinaryTree` (`BinaryTree(array)`, `BinaryTreeParentArray(tree)`), and through it a Dyck path.
