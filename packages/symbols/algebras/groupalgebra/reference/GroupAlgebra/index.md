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
  - origin: mapped
    form: sage
    template: enumeratio_group_algebra($1)
    arity: 1
    note: "`G.algebra(QQ)`."
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Wolfram has no group algebra object; its algebra heads are CliffordAlgebra, GrassmannAlgebra and WeylAlgebra.
    checked:
      version: 15.0.0
      on: 2026-10-23
stub: carrier
signatures:
  - call: GroupAlgebra(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>) -> group_algebra
---
