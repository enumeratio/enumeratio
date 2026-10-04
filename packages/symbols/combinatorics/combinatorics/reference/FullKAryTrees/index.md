---
name: FullKAryTrees
domain: Combinatorics
signature: FullKAryTrees(...)
summary: Trees where every internal node has exactly k children — the Fuss-Catalan count.
formerly:
  - KAryTrees
grades:
  - name: n
    role: axis
  - name: k
    role: axis
carrier: FullKAryTree
stub: carrier
signatures:
  - call: FullKAryTrees(...)
    description: Trees where every internal node has exactly k children — the Fuss-Catalan count.
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<full_k_ary_tree>
---
