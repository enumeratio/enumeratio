---
name: IsCentral
domain: Oracle
signature: IsCentral(...)
summary: Mapped through to oscar for the oracle; not yet written up here.
bindings:
  - origin: mapped
    form: oscar
    template: enumeratio_is_central($1, $2)
    arity: 2
  - origin: mapped
    form: sage
    template: enumeratio_is_central($1, $2)
    arity: 2
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Centrality of an element of our group algebra, written in its own labels (`GroupBasis`, `ClassSum`); Wolfram has no group algebra.
    checked:
      version: 15.0.0
      on: 2026-10-23
stub: carrier
signatures:
  - call: IsCentral(...)
    description: Mapped through to oscar for the oracle; not yet written up here.
    library: enumeratio-groupalgebra
    type: (expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct>, expression) -> boolean
---
