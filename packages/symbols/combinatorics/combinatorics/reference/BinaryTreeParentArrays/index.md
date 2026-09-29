---
name: BinaryTreeParentArrays
domain: Combinatorial collections
signature: BinaryTreeParentArrays(n)
summary: The binary trees with $n$ nodes, each as its in-order parent array.
signatures:
  - call: BinaryTreeParentArrays(n)
    description: the binary trees with $n$ nodes, as parent arrays
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<binary_tree_parent_array>
seeAlso:
  - BinaryTrees
  - BinarySearchTreeParentArray
grades:
  - name: n
    role: axis
carrier: BinaryTreeParentArray
---

- Number the nodes in order; entry $k$ is the number of the $k$-th node's parent, $0$ at the root. A node numbered below its parent is its left child, above it its right.
- Listed in [[BinaryTrees]]' order: [[BinaryTreeParentArray]] of the $k$-th tree is the $k$-th array.
- A binary search tree's values are its in-order numbers, so [[BinarySearchTreeParentArray]] lands here.
