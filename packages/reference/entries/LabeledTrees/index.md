---
name: LabeledTrees
domain: Combinatorics
signature: LabeledTrees(...)
summary: Catalogued in the enumeratio database, with crosswalk rows in oeis; not yet written up here.
catalog:
  - system: oeis
    identity: A000272
    url: https://oeis.org/A000272
stub: carrier
grades:
  - name: n
    role: axis
carrier: LabeledTree
signatures:
  - call: LabeledTrees(...)
    description: Catalogued in the enumeratio database, with crosswalk rows in oeis; not yet written up here.
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<list<integer>>>
---
