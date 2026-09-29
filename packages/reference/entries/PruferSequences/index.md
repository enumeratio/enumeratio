---
name: PruferSequences
domain: Combinatorics
signature: PruferSequences(...)
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
  - call: PruferSequences(...)
    description: Catalogued in the enumeratio database, with crosswalk rows in oeis; not yet written up here.
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
---
