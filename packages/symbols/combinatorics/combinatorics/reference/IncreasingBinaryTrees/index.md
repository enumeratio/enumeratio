---
name: IncreasingBinaryTrees
domain: Combinatorics
signature: IncreasingBinaryTrees(...)
summary: Binary trees on n labeled nodes, heap-ordered by label — n! of them.
grades:
  - name: n
    role: axis
carrier: IncreasingBinaryTree
stub: carrier
signatures:
  - call: IncreasingBinaryTrees(...)
    description: Binary trees on n labeled nodes, heap-ordered by label — n! of them.
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<increasing_binary_tree>
---
