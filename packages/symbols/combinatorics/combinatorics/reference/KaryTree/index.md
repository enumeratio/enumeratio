---
name: KaryTree
domain: Collections
signature: KaryTree(n) / KaryTree(n, k)
summary: The k-ary tree on n vertices, in breadth-first (heap) layout — sized by vertex count, not depth.
signatures:
  - call: KaryTree(n)
    description: the binary (k = 2) tree on n vertices
    library: enumeratio-combinatorics
    type: (integer, integer?) -> value
  - call: KaryTree(n, k)
    description: the k-ary tree on n vertices
    library: enumeratio-combinatorics
seeAlso:
  - CompleteKaryTree
names:
  wolframIdentity: true
---

- Vertex i's parent is ⌊(i - 2) / k⌋ + 1 — the same heap layout [[CompleteKaryTree]] uses, but sized by VERTEX COUNT rather than level count, so the last level need not be full.
- NOT the same thing as our [[FullKAryTrees]] DOMAIN (the combinatorial family of every n-node full k-ary tree shape, for ranking/enumeration) or [[CompleteKaryTree]] (a LEVEL count, always perfectly filled) — three different heads that happen to share a name fragment.
