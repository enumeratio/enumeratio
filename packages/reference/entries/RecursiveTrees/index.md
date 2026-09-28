---
name: RecursiveTrees
domain: Combinatorics
signature: RecursiveTrees(...)
summary: Increasing trees on n labeled vertices — (n−1)! of them.
grades:
  - name: n
    role: axis
carrier: RootedLabeledTree
stub: carrier
signatures:
  - call: RecursiveTrees(...)
    description: Increasing trees on n labeled vertices — (n−1)! of them.
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<integer>>
---
