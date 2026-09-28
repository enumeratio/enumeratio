---
name: GroupCentreDimension
domain: Oracle
signature: GroupCentreDimension(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: number_of_conjugacy_classes(($1).G)
    arity: 1
stub: carrier
signatures:
  - call: GroupCentreDimension(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> integer
---
