---
name: BinaryTrees
domain: Combinatorial collections
signature: BinaryTrees(n)
summary: "The binary trees with $n$ internal nodes, as nested lists: a leaf is $0$, a node $[L, R]$."
signatures:
  - call: BinaryTrees(n)
    description: the binary trees with $n$ internal nodes
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<binary_tree>
seeAlso:
  - DyckPaths
  - BinaryTreeParentArrays
  - CatalanNumber
references:
  - system: wikipedia
    identity: Binary tree
  - system: mathworld
    identity: BinaryTree
  - system: oeis
    identity: A000108
catalog:
  - system: oeis
    identity: A000108
    url: https://oeis.org/A000108
  - system: sage
    identity: BinaryTrees(n)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/binary_tree.html
  - system: wikipedia
    identity: Binary tree
    url: https://en.wikipedia.org/wiki/Binary_tree
    relation: conceptual
grades:
  - name: n
    role: axis
carrier: BinaryTree
---

- Count is the Catalan number $C_n$ (see [[CatalanNumber]])
- Listed by the size of the left subtree, then the left subtree's rank, then the right's. [[DyckPaths]] lists the same objects in another order: `DyckPath(tree)` (up, left tree, down, right tree) is a bijection, so every Dyck path statistic answers on a tree, but the $k$-th tree doesn't go to the $k$-th path.
- [[BinaryTreeParentArrays]] lists the same trees flat, in the same order.
