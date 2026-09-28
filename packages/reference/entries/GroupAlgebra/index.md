---
name: GroupAlgebra
domain: Oracle
signature: GroupAlgebra(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: ($1).A
    arity: 1
stub: carrier
signatures:
  - call: GroupAlgebra(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> group_algebra
---
